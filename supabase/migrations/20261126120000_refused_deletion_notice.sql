-- =============================================================================
-- A REFUSED deletion still transferred the household: tell the new owner,
-- neutrally.
-- Spec: _bmad-output/implementation-artifacts/spec-refused-deletion-notice.md
--
-- prepare_account_deletion transfers the household BEFORE the auth delete, and
-- that transfer stands when the delete is then refused. Its notice was only
-- STAGED (20261125100000: "its creator deleted their account" may be said only
-- if the deletion happens), so the new owner was never told. Niki (2026-11-26):
-- a NEUTRAL notice - "{household} is now yours. You are its owner and admin." -
-- claiming only the transfer, which really happened, and nothing about a
-- deletion.
--
-- A NEW KIND, not household_transferred with another cause (review 2026-11-26,
-- HIGH): every app version before this one maps household_transferred to "Its
-- creator deleted their account..." whatever the cause - an open tab from before
-- the deploy, or a rollback, would show the neutral notice as exactly that false
-- claim. For an unknown kind those versions return no message: the notice is
-- hidden (card) and skipped (push), never falsified.
--
-- ADDITIVE, APPLY-FIRST. The code deployed now never writes the new kind or
-- cause and never calls the new function. 20261125100000 is FROZEN.
-- =============================================================================

-- The CHECK swap takes ACCESS EXCLUSIVE on account_notices. While it WAITS for
-- that lock, every new lock request on the table queues behind it - including a
-- deletion's notice publish, which gives up after its own 1 s. So the wait is
-- shorter than that: if the lock is not free within 500 ms the apply fails
-- cleanly (nothing applied, ledger unchanged) and is retried.
SET lock_timeout = '500ms';

-- -----------------------------------------------------------------------------
-- 1. The new kind and its cause. Wider CHECKs only: every existing row satisfies
--    them. The CAUSE is 'ownership_transferred', deliberately not
--    'deletion_refused': the recipient's API payload (persisted in their
--    browser) must not reveal what the neutral text withholds - that someone
--    tried to delete their account. ONE statement, so the table is never without either constraint; NO
--    "IF EXISTS", so a different constraint name fails the apply loudly instead
--    of leaving the old CHECK in place (both names verified in production).
--    pending_account_notices keeps its own CHECKs: this notice is never staged.
-- -----------------------------------------------------------------------------
ALTER TABLE public.account_notices
  DROP CONSTRAINT account_notices_kind_check,
  ADD CONSTRAINT account_notices_kind_check CHECK (kind IN (
    'household_transferred', 'categories_copied', 'category_renamed', 'shared_plans_received',
    'household_now_yours'     -- a REFUSED deletion transferred the household: neutral
  )),
  DROP CONSTRAINT account_notices_cause_check,
  ADD CONSTRAINT account_notices_cause_check CHECK (cause IN (
    'account_deleted', 'member_removed', 'ownership_transferred'
  ));

-- -----------------------------------------------------------------------------
-- 2. Publish the neutral notice for a CONFIRMED refusal.
--
--    The app calls this only after confirming the refusal by effect: the auth
--    delete returned an outcome-known error AND getUserById found the same user
--    (settingsService.deleteUserAccount - the condition PR 1 uses for "your
--    account was not deleted"). Never on an ambiguous timeout.
--
--    Per staged household_transferred row of THAT person, ONE guarded block:
--    the staged "its creator deleted their account" is WITHDRAWN first, and the
--    neutral notice (kind household_now_yours, cause ownership_transferred) is
--    written only if a row really was withdrawn - so nothing
--    that already took that row (a deletion, a parallel call) is told twice. A
--    failure rolls the block back: the staged row is kept, so a later
--    successful retry still tells the transfer, once. The attempt's OTHER
--    staged notices (renames, copies, moved plans) stay staged: they publish
--    if a retry succeeds, when "deleted their account" becomes true.
--
--    The text must be true NOW: the recipient still owns the household AND is
--    its admin ("You are its owner and admin"), read under FOR SHARE so neither
--    can change before this commits; the name is the household's current one.
--    Otherwise nothing is published and the staged row is left as it was. (A
--    person who no longer exists needs no check: their staged rows went with
--    their auth row, ON DELETE CASCADE.)
--
--    SERIALISED with the person's own deletion: their auth row is locked FOR NO
--    KEY UPDATE first. A deletion takes FOR UPDATE on that row, so it cannot run
--    between reading the staged transfer and withdrawing it. A deletion already
--    in flight makes this give up after the lock_timeout (recorded): the
--    deletion then tells the new owner, truthfully, once. NO KEY UPDATE does not
--    block foreign-key checks (KEY SHARE).
--
--    Never raises: every failure - the lock, reading the rows, one notice - is
--    recorded in private.account_notice_failures (stage 'refusal'), where the
--    nightly health check reads it, and the caller's refusal stands either way.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_refused_deletion_notices(p_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '1s'
AS $$
DECLARE
  v_notice RECORD;
  v_withdrawn UUID;
  v_published INTEGER := 0;
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    PERFORM 1 FROM auth.users WHERE id = p_user FOR NO KEY UPDATE;

    FOR v_notice IN
      SELECT p.id, p.recipient_id, p.household_id, h.name AS household_name
        FROM private.pending_account_notices p
        JOIN public.households h ON h.id = p.household_id
       WHERE p.departing_user = p_user
         AND p.kind = 'household_transferred'
         AND p.recipient_id <> p_user
         AND h.created_by = p.recipient_id                -- "is now yours": true now
         AND EXISTS (SELECT 1 FROM public.household_members m
                      WHERE m.household_id = h.id AND m.user_id = p.recipient_id
                        AND m.role = 'admin')             -- "...and admin": true now
       ORDER BY p.created_at, p.id
       FOR SHARE OF h
    LOOP
      BEGIN
        DELETE FROM private.pending_account_notices WHERE id = v_notice.id
          RETURNING id INTO v_withdrawn;
        IF v_withdrawn IS NOT NULL THEN
          INSERT INTO public.account_notices (recipient_id, kind, cause, household_id, params)
          VALUES (v_notice.recipient_id, 'household_now_yours', 'ownership_transferred',
                  v_notice.household_id,
                  jsonb_build_object('household', v_notice.household_name));
          v_published := v_published + 1;
        END IF;
        v_withdrawn := NULL;
      EXCEPTION WHEN OTHERS THEN
        v_state := SQLSTATE;
        v_message := SQLERRM;
        v_withdrawn := NULL;
        BEGIN
          INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
          VALUES ('refusal', 'household_now_yours', v_state);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
        END;
        RAISE WARNING 'refused-deletion notice not published: % (%)', v_message, v_state;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- The lock, or reading the staged rows, failed (most likely the person's
    -- deletion is in flight: it will tell the new owner). Nothing is published
    -- from here on; what this call already published stands.
    v_state := SQLSTATE;
    v_message := SQLERRM;
    BEGIN
      INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
      VALUES ('refusal', NULL, v_state);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
    END;
    RAISE WARNING 'refused-deletion notices not published: % (%)', v_message, v_state;
  END;

  RETURN v_published;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_refused_deletion_notices(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_refused_deletion_notices(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_refused_deletion_notices(UUID) TO service_role;
COMMENT ON FUNCTION public.publish_refused_deletion_notices(UUID) IS
  'For a CONFIRMED refused deletion: per staged household_transferred notice of that person whose recipient still owns and administers the household, withdraws it and writes a neutral household_now_yours notice (cause ownership_transferred), atomically. Every failure is recorded (stage refusal), never raised. service_role only.';
