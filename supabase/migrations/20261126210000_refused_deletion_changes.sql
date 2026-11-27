-- =============================================================================
-- A REFUSED deletion: every real change it made is told, neutrally - not only
-- the household.
-- Spec: _bmad-output/implementation-artifacts/spec-refused-deletion-neutral-variants.md
--
-- prepare_account_deletion makes its changes BEFORE the auth delete, and they
-- stand when the delete is then refused: the household is transferred, shared
-- categories (renamed where the owner already had the name), goals and budgets
-- go to the owner, and people who used the person's categories get their own
-- copies. #109 (20261126120000) tells the household transfer neutrally; the
-- others stay staged and are told only if a retry succeeds - with no retry,
-- nobody is ever told about a real change. Niki (2026-11-26): on a confirmed
-- refusal, withdraw ALL of the attempt's waiting notices and write neutral
-- variants, claiming only what changed.
--
-- NEW KINDS, for #109's reason (review, HIGH): an older app shows
-- category_renamed / categories_copied / shared_plans_received with their
-- deletion texts whatever the cause, but returns no message for a kind it does
-- not know - the notice is hidden (card) and skipped (push), never falsified.
--
-- A NEW FUNCTION, not a replacement of #109's: expand now, contract later.
-- Replacing it would change what the DEPLOYED app does the moment this lands
-- (it would write kinds that app hides and never pushes); a rollback would keep
-- doing so. With a new function the deployed app and a rollback behave exactly
-- as before, and the new code makes one call that tells everything.
-- publish_refused_deletion_notices stays until no deployed code calls it.
--
-- ADDITIVE, APPLY-FIRST. The code deployed now never writes the new kinds or
-- causes and never calls the new function; every existing row satisfies the new
-- constraints. 20261125100000 and 20261126120000 are FROZEN.
-- =============================================================================

-- The CHECK swap takes ACCESS EXCLUSIVE on account_notices; while it WAITS, every
-- new lock request on the table queues behind it - including a deletion's notice
-- publish, which gives up after its own 1 s. So the wait is shorter than that:
-- if the lock is not free within 500 ms the apply fails cleanly (nothing applied,
-- ledger unchanged) and can simply be run again. RESET at the end, so a later
-- migration in the same session does not inherit it.
SET lock_timeout = '500ms';

-- -----------------------------------------------------------------------------
-- 1. The new kinds and causes, and WHICH cause each kind may carry.
--    Causes name the CHANGE, never the refused deletion behind it - the
--    recipient's payload (persisted in their browser) must not reveal what the
--    neutral text withholds: 'ownership_transferred' where the recipient now
--    owns what was the person's (household, shared plans, a shared category),
--    'copies_made' where they were given copies. The pairing is a CONSTRAINT,
--    not only a habit of the one writer: a neutral kind can never carry a
--    deletion cause, and a deletion kind - whose text claims a deletion or a
--    removal - can never carry a neutral one.
--    ONE statement, so the table is never without its constraints; NO
--    "IF EXISTS", so a different constraint name fails the apply loudly.
--    pending_account_notices keeps its own CHECKs: these notices are never staged.
-- -----------------------------------------------------------------------------
ALTER TABLE public.account_notices
  DROP CONSTRAINT account_notices_kind_check,
  ADD CONSTRAINT account_notices_kind_check CHECK (kind IN (
    'household_transferred', 'categories_copied', 'category_renamed', 'shared_plans_received',
    'household_now_yours',      -- a REFUSED deletion transferred the household (#109)
    'shared_plans_now_yours',   -- ...moved shared goals or budgets to the owner
    'shared_category_renamed',  -- ...moved a shared category to the owner, renamed
    'category_copies_made'      -- ...gave a person copies of categories they used
  )),
  DROP CONSTRAINT account_notices_cause_check,
  ADD CONSTRAINT account_notices_cause_check CHECK (cause IN (
    'account_deleted', 'member_removed', 'ownership_transferred', 'copies_made'
  )),
  ADD CONSTRAINT account_notices_kind_cause_check CHECK (
    CASE
      WHEN kind IN ('household_now_yours', 'shared_plans_now_yours', 'shared_category_renamed')
        THEN cause = 'ownership_transferred'
      WHEN kind = 'category_copies_made'
        THEN cause = 'copies_made'
      ELSE cause IN ('account_deleted', 'member_removed')
    END
  );

-- -----------------------------------------------------------------------------
-- 2. Tell everything a CONFIRMED refused deletion changed.
--
--    The app calls this only after confirming the refusal by effect: the auth
--    delete returned an outcome-known error AND getUserById found the same user
--    (settingsService.deleteUserAccount - PR 1's condition for "your account was
--    not deleted"). Never on an ambiguous timeout.
--
--    EVERY staged row of THAT person is withdrawn (Niki: "withdraw ALL"), each in
--    ONE guarded block:
--      - the neutral claim is checked against the database NOW (below), with
--        its household row locked FOR SHARE;
--      - the staged row is WITHDRAWN first, and the neutral notice written only
--        if the claim holds AND a row really was withdrawn - so nothing that
--        already took it (a deletion, a parallel call) is told twice;
--      - a claim that is FALSE now is withdrawn and told to no one: left staged,
--        a later successful deletion would publish it unchecked, with its
--        deletion text - a known-false claim;
--      - a failure rolls back THIS block only: that row stays staged (a later
--        successful deletion still tells it, once), it is recorded with its
--        neutral kind, and every other row goes on.
--
--    Claims checked:
--      household_now_yours     "is now yours ... owner and admin": the recipient
--                              is the household's created_by AND an admin;
--      shared_plans_now_yours  "are now yours", "belonged to another member of
--                              H": the recipient is still a member and holds
--                              shared goals or budgets in it (the staged row does
--                              not record WHICH ones, so their own count too);
--      shared_category_renamed "of H ... is now yours": the recipient is still a
--                              member and owns a category of H with the new name;
--      category_copies_made    "your entries point to the copies": only the
--                              copied names the recipient still owns as PERSONAL
--                              categories (copies are made personal) are listed;
--                              with none left, nothing is told.
--    Their CURRENT household name is used. prepare and remove_household_member
--    take the household row FOR UPDATE, so FOR SHARE on it serialises with both
--    (as in #109). The member and category rows a claim reads are not locked: a
--    role change or a rename committed in the milliseconds between the check and
--    this commit is not excluded - the claim was true when checked.
--    Locks are taken per ROW, not by the loop's query; and once a household's
--    row could not be locked (55P03 after the lock_timeout), its remaining rows
--    are recorded and kept WITHOUT waiting again - one household someone is
--    changing costs one wait, not one per row, and never the other rows. Rows
--    are taken in a FIXED order within an attempt (household, plans, renamed
--    categories, copies), so which one waits is never down to chance.
--
--    SERIALISED with the person's own deletion: their auth row is locked FOR NO
--    KEY UPDATE first. A deletion takes FOR UPDATE on that row, so it cannot run
--    between reading a staged row and withdrawing it. A deletion already in
--    flight makes this give up after the lock_timeout: nothing is published,
--    and that deletion tells everyone, truthfully, once. NO KEY UPDATE does not
--    block foreign-key checks (KEY SHARE).
--
--    Never raises. The lock and the read of the staged rows' IDS are the only
--    statements outside the rows' own blocks, and both come before anything is
--    written: if either fails, that is recorded and the call returns 0 with every
--    staged row kept. Each row is then re-read inside its own block. (A guard
--    around the whole loop would be wrong: PL/pgSQL rolls back everything since a
--    block began when it catches, rows already told included - #109's function
--    has that shape.) Plain types only, so the function compiles - and contains
--    its own failure - even if a table it reads is gone. Every failure is
--    recorded in private.account_notice_failures (stage 'refusal'), where the
--    nightly health check reads it; the caller's refusal stands either way.
--    Returns how many neutral notices it wrote.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_refused_deletion_changes(p_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '1s'
AS $$
DECLARE
  v_ids UUID[];
  v_id UUID;
  v_staged_kind TEXT;
  v_recipient UUID;
  v_household UUID;
  v_params JSONB;
  v_kind TEXT;
  v_claim_lock BOOLEAN;
  v_locked_out UUID[] := '{}';
  v_household_name TEXT;
  v_names JSONB;
  v_true BOOLEAN;
  v_withdrawn UUID;
  v_published INTEGER := 0;
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    PERFORM 1 FROM auth.users WHERE id = p_user FOR NO KEY UPDATE;

    SELECT coalesce(array_agg(p.id ORDER BY p.created_at,
                                CASE p.kind WHEN 'household_transferred' THEN 1
                                            WHEN 'shared_plans_received' THEN 2
                                            WHEN 'category_renamed' THEN 3
                                            ELSE 4 END,
                                p.id), '{}')
      INTO v_ids
      FROM private.pending_account_notices p
     WHERE p.departing_user = p_user
       AND p.recipient_id <> p_user;
  EXCEPTION WHEN OTHERS THEN
    -- Most likely the person's deletion is in flight (it holds their auth row,
    -- and will tell everyone itself). Nothing has been written yet.
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

  FOREACH v_id IN ARRAY v_ids
  LOOP
    v_kind := NULL;
    v_household := NULL;
    v_claim_lock := false;
    BEGIN
      SELECT p.kind, p.recipient_id, p.household_id, p.params
        INTO v_staged_kind, v_recipient, v_household, v_params
        FROM private.pending_account_notices p
       WHERE p.id = v_id;
      -- Taken since the ids were read (by a parallel call): nothing left to tell.
      CONTINUE WHEN NOT FOUND;

      v_kind := CASE v_staged_kind
        WHEN 'household_transferred' THEN 'household_now_yours'
        WHEN 'shared_plans_received' THEN 'shared_plans_now_yours'
        WHEN 'category_renamed'      THEN 'shared_category_renamed'
        WHEN 'categories_copied'     THEN 'category_copies_made'
      END;
      -- The staging CHECK allows only those four; anything else is not ours to tell.
      CONTINUE WHEN v_kind IS NULL;

      IF v_household = ANY (v_locked_out) THEN
        RAISE EXCEPTION 'household % could not be locked for an earlier notice', v_household
          USING ERRCODE = 'lock_not_available';
      END IF;

      -- Is the neutral claim TRUE NOW? Its household row is locked until commit.
      v_claim_lock := true;
      v_household_name := NULL;
      v_names := NULL;
      IF v_staged_kind = 'household_transferred' THEN
        SELECT h.name INTO v_household_name
          FROM public.households h
          JOIN public.household_members m
            ON m.household_id = h.id AND m.user_id = v_recipient AND m.role = 'admin'
         WHERE h.id = v_household AND h.created_by = v_recipient
           FOR SHARE OF h;
        v_true := FOUND;
      ELSIF v_staged_kind = 'shared_plans_received' THEN
        SELECT h.name INTO v_household_name
          FROM public.households h
          JOIN public.household_members m
            ON m.household_id = h.id AND m.user_id = v_recipient
         WHERE h.id = v_household
           AND (EXISTS (SELECT 1 FROM public.goals g
                         WHERE g.user_id = v_recipient AND g.household_id = h.id)
                OR EXISTS (SELECT 1 FROM public.category_budgets b
                            WHERE b.user_id = v_recipient AND b.household_id = h.id))
           FOR SHARE OF h;
        v_true := FOUND;
      ELSIF v_staged_kind = 'category_renamed' THEN
        SELECT h.name INTO v_household_name
          FROM public.households h
          JOIN public.household_members m
            ON m.household_id = h.id AND m.user_id = v_recipient
          JOIN public.categories c
            ON c.household_id = h.id AND c.user_id = v_recipient AND c.name = v_params->>'to'
         WHERE h.id = v_household
           FOR SHARE OF h;
        v_true := FOUND;
      ELSE -- categories_copied: no household
        SELECT coalesce(jsonb_agg(n.name ORDER BY n.name), '[]'::jsonb) INTO v_names
          FROM (SELECT DISTINCT e.name
                  FROM jsonb_array_elements_text(v_params->'categories') AS e(name)) n
         WHERE EXISTS (SELECT 1 FROM public.categories c
                        WHERE c.user_id = v_recipient AND c.household_id IS NULL
                          AND c.name = n.name);
        v_true := jsonb_array_length(v_names) > 0;
      END IF;
      v_claim_lock := false;

      DELETE FROM private.pending_account_notices WHERE id = v_id
        RETURNING id INTO v_withdrawn;
      IF v_withdrawn IS NOT NULL AND v_true THEN
        INSERT INTO public.account_notices (recipient_id, kind, cause, household_id, params)
        VALUES (
          v_recipient,
          v_kind,
          CASE WHEN v_kind = 'category_copies_made' THEN 'copies_made'
               ELSE 'ownership_transferred' END,
          v_household,
          CASE v_kind
            WHEN 'shared_category_renamed' THEN
              jsonb_build_object('household', v_household_name,
                                 'from', v_params->'from',
                                 'to', v_params->'to')
            WHEN 'category_copies_made' THEN
              -- No subject: whose categories they were, and why, is not told.
              jsonb_build_object('categories', v_names)
            ELSE
              jsonb_build_object('household', v_household_name)
          END
        );
        v_published := v_published + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_message := SQLERRM;
      IF v_state = '55P03' AND v_claim_lock AND v_household IS NOT NULL THEN
        v_locked_out := v_locked_out || v_household;
      END IF;
      BEGIN
        INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
        VALUES ('refusal', v_kind, v_state);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
      END;
      RAISE WARNING 'refused-deletion notice not published (kind %): % (%)', v_kind, v_message, v_state;
    END;
  END LOOP;

  RETURN v_published;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_refused_deletion_changes(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_refused_deletion_changes(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_refused_deletion_changes(UUID) TO service_role;
COMMENT ON FUNCTION public.publish_refused_deletion_changes(UUID) IS
  'For a CONFIRMED refused deletion: withdraws every staged notice of that person and, where its neutral claim is true now, writes the neutral variant (household_now_yours, shared_plans_now_yours, shared_category_renamed, category_copies_made), atomically per row. Every failure is recorded (stage refusal), never raised. Supersedes publish_refused_deletion_notices. service_role only.';

RESET lock_timeout;
