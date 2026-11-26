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
-- ADDITIVE, APPLY-FIRST. The code deployed now never writes the new cause and
-- never calls the new function. 20261125100000 is FROZEN and untouched.
-- =============================================================================

-- Takes ACCESS EXCLUSIVE on account_notices briefly (the CHECK swap): never
-- queue behind a long transaction - fail cleanly and retry.
SET lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. A cause for a notice about a refused deletion. A wider CHECK only: every
--    existing row satisfies it. pending_account_notices keeps its own CHECK -
--    a neutral notice is never staged.
-- -----------------------------------------------------------------------------
ALTER TABLE public.account_notices DROP CONSTRAINT IF EXISTS account_notices_cause_check;
ALTER TABLE public.account_notices ADD CONSTRAINT account_notices_cause_check
  CHECK (cause IN ('account_deleted', 'member_removed', 'deletion_refused'));

-- -----------------------------------------------------------------------------
-- 2. Publish the neutral notice for a CONFIRMED refusal.
--
--    The app calls this only after confirming the refusal by effect: the auth
--    delete returned an outcome-known error AND getUserById found the same user
--    (settingsService.deleteUserAccount - the condition PR 1 uses for "your
--    account was not deleted"). Never on an ambiguous timeout.
--
--    Per staged household_transferred row of that person, ONE guarded block:
--    the neutral notice is written AND the staged "its creator deleted their
--    account" is removed, or neither. So a later successful retry can never tell
--    the same transfer a second time. The attempt's OTHER staged notices
--    (renames, copies, moved plans) stay staged: they publish if a retry
--    succeeds, when "deleted their account" becomes true.
--
--    The text must be true NOW: the recipient still owns that household.
--    Otherwise nothing is published and the staged row is left exactly as it
--    was. (A person who no longer exists needs no check: their staged rows went
--    with their auth row, ON DELETE CASCADE, so there is nothing to publish.)
--
--    SERIALISED with the person's own deletion: their auth row is locked FOR NO
--    KEY UPDATE first. A deletion takes FOR UPDATE on that row, so it cannot run
--    between reading the staged transfer and withdrawing it - which is the
--    window in which its trigger would publish "its creator deleted their
--    account" as well. A deletion already in flight makes this give up after the
--    lock_timeout (recorded): the deletion then tells the new owner, truthfully,
--    once. NO KEY UPDATE does not block foreign-key checks (KEY SHARE).
--
--    Never raises for a notice: a failure rolls back that one block (the staged
--    row is kept), is recorded in private.account_notice_failures (stage
--    'refusal'), where the nightly health check reads it, and the caller's
--    refusal stands either way.
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
  v_published INTEGER := 0;
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    PERFORM 1 FROM auth.users WHERE id = p_user FOR NO KEY UPDATE;
  EXCEPTION WHEN OTHERS THEN
    -- Most likely the person's deletion is in flight: it will tell the new owner.
    v_state := SQLSTATE;
    v_message := SQLERRM;
    BEGIN
      INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
      VALUES ('refusal', NULL, v_state);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
    END;
    RAISE WARNING 'refused-deletion notices not published: % (%)', v_message, v_state;
    RETURN 0;
  END;

  FOR v_notice IN
    SELECT p.id, p.recipient_id, p.household_id, p.params
      FROM private.pending_account_notices p
      JOIN public.households h ON h.id = p.household_id
     WHERE p.departing_user = p_user
       AND p.kind = 'household_transferred'
       AND p.recipient_id <> p_user
       AND h.created_by = p.recipient_id   -- "is now yours" must be true now
     ORDER BY p.created_at, p.id
  LOOP
    BEGIN
      INSERT INTO public.account_notices (recipient_id, kind, cause, household_id, params)
      VALUES (v_notice.recipient_id, 'household_transferred', 'deletion_refused',
              v_notice.household_id,
              jsonb_build_object('household', v_notice.params ->> 'household'));
      DELETE FROM private.pending_account_notices WHERE id = v_notice.id;
      v_published := v_published + 1;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_message := SQLERRM;
      BEGIN
        INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
        VALUES ('refusal', 'household_transferred', v_state);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
      END;
      RAISE WARNING 'refused-deletion notice not published: % (%)', v_message, v_state;
    END;
  END LOOP;

  RETURN v_published;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_refused_deletion_notices(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_refused_deletion_notices(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_refused_deletion_notices(UUID) TO service_role;
COMMENT ON FUNCTION public.publish_refused_deletion_notices(UUID) IS
  'For a CONFIRMED refused deletion: per staged household_transferred notice whose recipient still owns the household, writes a neutral notice (cause deletion_refused) and removes the staged one, atomically. A failure is recorded (stage refusal), never raised. service_role only.';
