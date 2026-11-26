-- =============================================================================
-- Account notices: tell the people who STAY what an account deletion or a
-- member's removal changed for them.
-- Spec: _bmad-output/implementation-artifacts/spec-account-deletion-notifications.md
--
-- ADDITIVE, APPLY-FIRST. The two functions migration 20261119100000 created keep
-- their exact signatures and return shapes:
--   reassign_member_shared_objects(uuid, uuid) RETURNS INTEGER
--   prepare_account_deletion(uuid)             RETURNS JSONB, same keys
-- so the code already deployed works against this schema unchanged. That
-- migration's FILE is frozen; its functions are replaced here, the normal way.
--
-- A NOTICE EXISTS ONLY IF ITS EVENT HAPPENED (review 1). The deletion's changes
-- are made by prepare_account_deletion, but the deletion itself is a later,
-- separate GoTrue call that can be REFUSED. So prepare only STAGES its notices
-- (private.pending_account_notices, keyed by the departing user), and the
-- BEFORE DELETE trigger on auth.users PUBLISHES them inside the deletion's own
-- transaction: a refused deletion rolls the publication back with it. A removal
-- is one transaction (public.remove_household_member), so its notices commit
-- only with the membership delete.
--
-- P2: account_notices holds a KIND, a CAUSE and non-personal params (household
-- name, category names, counts) - never the departing person. Their id sits only
-- in the staged row, which goes with their auth row (ON DELETE CASCADE). The
-- residue scan in account-deletion.rls.test.ts searches every column (public,
-- storage, private) for their id, email and display name.
--
-- OFF THE CRITICAL PATH (Niki): a notice failure never fails or rolls back a
-- deletion or a removal. Every notice statement - computing what a notice says,
-- calling the writer, staging, writing, publishing - runs inside an EXCEPTION
-- block (a savepoint), so a failure rolls back that block ALONE and the deletion
-- or removal carries on exactly as before. That includes the publish, which runs
-- inside the auth.users delete itself (section 5).
--
-- A CONTAINED FAILURE IS NEVER SILENT. Every handler writes ONE marker row (per
-- contained exception) to private.account_notice_failures, which the OUTER
-- transaction keeps: a 'publish' marker commits with the deletion, a 'write'
-- marker with the removal, a 'stage' marker with the preparation (which commits
-- even if the deletion is then refused). The nightly "Account Notice Health"
-- workflow reads the unacknowledged count through
-- public.account_notice_failure_summary() as schema_reader (the drift check's
-- read-only role) and fails while any are unacknowledged; its watchdog keeps ONE
-- GitHub issue open until then. If even the marker cannot be written, a WARNING
-- in the Postgres log is the last resort, and the operation still completes.
--
-- "Never fails" means every error a handler can catch. The one class PL/pgSQL
-- cannot catch, query_canceled, is kept out of the publish by a lock_timeout
-- (section 5): there is no other long wait in it.
-- =============================================================================

-- Applying this takes SHARE ROW EXCLUSIVE on auth.users (three foreign keys and
-- a trigger) and on households. Never queue every sign-up and sign-in behind a
-- long transaction: if the locks are not free within 5 s, the apply fails cleanly
-- and is retried.
SET lock_timeout = '5s';

-- -----------------------------------------------------------------------------
-- 1. The notices people see. Until dismissed, no expiry (Niki, 2026-11-20).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The person who STAYS. Their notices go with their own account.
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'household_transferred',  -- you now own the household
    'categories_copied',      -- you now have your own copies of categories you used
    'category_renamed',       -- a shared category is now yours, renamed
    'shared_plans_received'   -- shared goals or budgets are now yours
  )),
  cause TEXT NOT NULL CHECK (cause IN ('account_deleted', 'member_removed')),
  -- The household's own row; a deleted household takes its notices with it.
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  -- Non-personal, rendered by the app in the reader's language. Never text.
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.account_notices IS
  'What an account deletion or member removal changed for a person who stays. Kind + params only (never text, never the departed person). Shown until dismissed. Written only by private.record_account_notice and private.publish_account_notices; read own via RLS; dismissed via the service role.';

CREATE INDEX IF NOT EXISTS idx_account_notices_open
  ON public.account_notices (recipient_id, created_at)
  WHERE dismissed_at IS NULL;
-- The foreign keys' own indexes: the cascades on a deleted recipient or household.
CREATE INDEX IF NOT EXISTS idx_account_notices_recipient ON public.account_notices (recipient_id);
CREATE INDEX IF NOT EXISTS idx_account_notices_household ON public.account_notices (household_id);

ALTER TABLE public.account_notices ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges grant ALL on new tables to anon/authenticated,
-- and GRANTs are additive: revoke first, then grant only the read.
REVOKE ALL ON public.account_notices FROM PUBLIC;
REVOKE ALL ON public.account_notices FROM anon;
REVOKE ALL ON public.account_notices FROM authenticated;
GRANT SELECT ON public.account_notices TO authenticated;
-- The server (crons, dismissal) - stated, not left to default privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_notices TO service_role;

DROP POLICY IF EXISTS "own notices are readable" ON public.account_notices;
CREATE POLICY "own notices are readable" ON public.account_notices
  FOR SELECT TO authenticated
  USING (recipient_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- 2. Notices STAGED by prepare_account_deletion, waiting for the deletion.
--    Not exposed (private schema), no client privileges at all.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.pending_account_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The only place the departing person's id is held - and only while their
  -- account exists: this row goes with their auth row.
  departing_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The same CHECKs as account_notices: a value that could never be published
  -- fails HERE, at staging, where it is recorded and loses only itself - not at
  -- publication, inside the deletion.
  kind TEXT NOT NULL CHECK (kind IN (
    'household_transferred', 'categories_copied', 'category_renamed', 'shared_plans_received'
  )),
  cause TEXT NOT NULL CHECK (cause IN ('account_deleted', 'member_removed')),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_account_notices_departing
  ON private.pending_account_notices (departing_user);
CREATE INDEX IF NOT EXISTS idx_pending_account_notices_recipient
  ON private.pending_account_notices (recipient_id);
CREATE INDEX IF NOT EXISTS idx_pending_account_notices_household
  ON private.pending_account_notices (household_id);
ALTER TABLE private.pending_account_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pending_account_notices FROM PUBLIC;
REVOKE ALL ON private.pending_account_notices FROM anon;
REVOKE ALL ON private.pending_account_notices FROM authenticated;
COMMENT ON TABLE private.pending_account_notices IS
  'Account-deletion notices staged by prepare_account_deletion. Published to public.account_notices by the auth.users BEFORE DELETE trigger, in the deletion''s own transaction; a refused deletion publishes nothing. Rows go with the departing user''s auth row.';

-- -----------------------------------------------------------------------------
-- 3. Where a CONTAINED failure goes, so that it is SEEN.
--    One row per failure: which stage, which notice kind, the SQLSTATE. Nothing
--    about any person - no ids, no names, and no error message, which can quote
--    a value; the full message goes to the Postgres log as a WARNING.
--    Deliberately no constraint beyond the key: this insert runs inside an error
--    handler, and every CHECK would be one more way for it to fail.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.account_notice_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'stage' (a deletion's notice, staged by prepare) | 'write' (a removal's) |
  -- 'publish' (the auth.users trigger)
  stage TEXT,
  -- The notice kind; NULL when a whole publication failed.
  kind TEXT,
  sqlstate TEXT,
  -- Set by a person who has read it. The health check counts the rest.
  acknowledged_at TIMESTAMPTZ
);
ALTER TABLE private.account_notice_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_notice_failures FROM PUBLIC;
REVOKE ALL ON private.account_notice_failures FROM anon;
REVOKE ALL ON private.account_notice_failures FROM authenticated;
COMMENT ON TABLE private.account_notice_failures IS
  'One row per CONTAINED account-notice failure (stage, kind, SQLSTATE; never a person). Written by the notice functions'' error handlers, kept by the outer transaction. Read only as counts, through public.account_notice_failure_summary(); acknowledge with UPDATE ... SET acknowledged_at = now().';

-- The only way to read it from outside: counts per (stage, kind, sqlstate),
-- unacknowledged only. EXECUTE for the server and for schema_reader, the
-- grantless role the drift check already logs in as, so the nightly health check
-- needs no new credential and gains no access to any row of any table.
CREATE OR REPLACE FUNCTION public.account_notice_failure_summary()
RETURNS TABLE (
  stage TEXT,
  kind TEXT,
  sqlstate TEXT,
  failures BIGINT,
  first_at TIMESTAMPTZ,
  last_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.stage, f.kind, f.sqlstate, count(*), min(f.created_at), max(f.created_at)
    FROM private.account_notice_failures f
   WHERE f.acknowledged_at IS NULL
   GROUP BY f.stage, f.kind, f.sqlstate
   ORDER BY f.stage, f.kind, f.sqlstate;
$$;

REVOKE ALL ON FUNCTION public.account_notice_failure_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_notice_failure_summary() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_notice_failure_summary() TO service_role;
-- schema_reader exists in production, made by hand for the drift check (see
-- .github/workflows/schema-drift.yml: LOGIN, NOINHERIT, no memberships, no
-- table grants). A fresh local or CI database has no such role, so it is made
-- here NOLOGIN; the GRANT is then the same statement everywhere, and the RLS
-- suite exercises it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'schema_reader') THEN
    CREATE ROLE schema_reader NOLOGIN NOINHERIT;
  END IF;
END
$$;
GRANT EXECUTE ON FUNCTION public.account_notice_failure_summary() TO schema_reader;
COMMENT ON FUNCTION public.account_notice_failure_summary() IS
  'Unacknowledged account-notice failures, as counts per (stage, kind, sqlstate). Read nightly by .github/workflows/account-notice-health.yml as schema_reader. service_role and schema_reader only.';

-- -----------------------------------------------------------------------------
-- 4. The ONE writer. p_departing set = a deletion's notice: STAGE it.
--    p_departing NULL = a removal's notice, already inside the removal's
--    transaction: write it. A failure is recorded (section 3), never raised.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.record_account_notice(
  p_recipient UUID,
  p_kind TEXT,
  p_cause TEXT,
  p_household UUID,
  p_params JSONB,
  p_departing UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  IF p_departing IS NOT NULL THEN
    INSERT INTO private.pending_account_notices
      (departing_user, recipient_id, kind, cause, household_id, params)
    VALUES (p_departing, p_recipient, p_kind, p_cause, p_household, COALESCE(p_params, '{}'::jsonb));
  ELSE
    INSERT INTO public.account_notices (recipient_id, kind, cause, household_id, params)
    VALUES (p_recipient, p_kind, p_cause, p_household, COALESCE(p_params, '{}'::jsonb));
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- The insert alone is rolled back; the caller's deletion or removal is not.
  v_state := SQLSTATE;
  v_message := SQLERRM;
  BEGIN
    INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
    VALUES (CASE WHEN p_departing IS NULL THEN 'write' ELSE 'stage' END, p_kind, v_state);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
  END;
  RAISE WARNING 'account notice not recorded (kind %): % (%)', p_kind, v_message, v_state;
END;
$$;

REVOKE ALL ON FUNCTION private.record_account_notice(UUID, TEXT, TEXT, UUID, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.record_account_notice(UUID, TEXT, TEXT, UUID, JSONB, UUID) FROM anon, authenticated;
COMMENT ON FUNCTION private.record_account_notice(UUID, TEXT, TEXT, UUID, JSONB, UUID) IS
  'The only writer of account notices: stages a deletion''s (p_departing set), writes a removal''s. A failure is recorded in private.account_notice_failures, never raised. Called only by the definer functions below.';

-- -----------------------------------------------------------------------------
-- 5. PUBLISH a deletion's notices - in the deletion's own transaction, so a
--    refused deletion publishes nothing. This runs INSIDE the auth.users delete:
--    if it raised, every account deletion would roll back. So:
--      - each notice is published in ITS OWN guarded block: one that cannot be
--        published (a recipient whose own deletion is in flight, a bad value)
--        loses only itself, and is recorded with its kind (section 3);
--      - reading the staged notices is guarded too: if even that fails, nothing
--        is published, and that is recorded (kind NULL);
--      - lock_timeout: a notice's foreign keys KEY SHARE-lock its recipient's
--        auth row and its household's row, which the departing person's own
--        delete does NOT touch. An unbounded wait there would hold up the
--        deletion, and a statement_timeout firing during it (query_canceled) is
--        the one error WHEN OTHERS cannot catch. With the timeout, a wait ends in
--        lock_not_available, which the per-notice block catches and records;
--      - if even the record fails, a WARNING is the last resort;
--      - the trigger always returns OLD, so the delete proceeds.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.publish_account_notices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '1s'
AS $$
DECLARE
  v_notice RECORD;
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    FOR v_notice IN
      SELECT p.recipient_id, p.kind, p.cause, p.household_id, p.params
        FROM private.pending_account_notices p
       WHERE p.departing_user = OLD.id
         AND p.recipient_id <> OLD.id
       ORDER BY p.created_at, p.id
    LOOP
      BEGIN
        INSERT INTO public.account_notices (recipient_id, kind, cause, household_id, params, created_at)
        VALUES (v_notice.recipient_id, v_notice.kind, v_notice.cause, v_notice.household_id,
                v_notice.params, now());
      EXCEPTION WHEN OTHERS THEN
        -- This notice is lost, the deletion and the other notices are not - and
        -- the loss is recorded where the nightly health check reads it.
        v_state := SQLSTATE;
        v_message := SQLERRM;
        BEGIN
          INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
          VALUES ('publish', v_notice.kind, v_state);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
        END;
        RAISE WARNING 'account notice not published (kind %): % (%)', v_notice.kind, v_message, v_state;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- The staged notices could not even be read: none is published.
    v_state := SQLSTATE;
    v_message := SQLERRM;
    BEGIN
      INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
      VALUES ('publish', NULL, v_state);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
    END;
    RAISE WARNING 'account notices not published for a deletion: % (%)', v_message, v_state;
  END;
  -- The staged rows go with the auth row (ON DELETE CASCADE, after this BEFORE
  -- trigger). If this DELETE is refused later in the statement, everything above
  -- rolls back with it.
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.publish_account_notices() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.publish_account_notices() FROM anon, authenticated;
COMMENT ON FUNCTION private.publish_account_notices() IS
  'BEFORE DELETE on auth.users: turns the departing user''s staged notices into account_notices, in the deletion''s transaction. Never raises: a failure is recorded in private.account_notice_failures and the delete proceeds.';

DROP TRIGGER IF EXISTS publish_account_notices_on_user_delete ON auth.users;
CREATE TRIGGER publish_account_notices_on_user_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.publish_account_notices();

-- -----------------------------------------------------------------------------
-- 6. Where a departing member's shared objects go - the rule from 20261119100000,
--    unchanged - now telling the owner what arrived.
--    p_cause: 'account_deleted' (staged, for publication on deletion),
--             'member_removed' (written, inside the removal's transaction),
--             NULL (no notices: the old two-step removal path, see 7).
--    The moves are the critical path; the loop only REMEMBERS the renames. Every
--    notice statement runs in one guarded block at the end.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.move_member_shared_objects(
  p_household UUID,
  p_member UUID,
  p_cause TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_household_name TEXT;
  v_departing UUID := CASE WHEN p_cause = 'account_deleted' THEN p_member END;
  v_cat RECORD;
  v_name TEXT;
  v_n INTEGER;
  v_moved INTEGER := 0;
  v_budgets INTEGER := 0;
  v_goals INTEGER := 0;
  v_renamed_from TEXT[] := '{}';
  v_renamed_to TEXT[] := '{}';
  v_i INTEGER;
  v_kind TEXT;
  v_state TEXT;
  v_message TEXT;
BEGIN
  SELECT created_by, name INTO v_owner, v_household_name
    FROM public.households WHERE id = p_household;
  -- No household, or the member IS the owner (ownership must be transferred
  -- before calling this): nothing to move.
  IF v_owner IS NULL OR v_owner = p_member THEN
    RETURN 0;
  END IF;

  -- Shared categories. categories is UNIQUE(user_id, name, type), so a name the
  -- owner already uses gets a LANGUAGE-NEUTRAL numeric suffix ("Name 2") - never
  -- a translated word frozen into stored data. Base truncated to fit VARCHAR(100).
  FOR v_cat IN
    SELECT id, name, type FROM public.categories
     WHERE user_id = p_member AND household_id = p_household
     ORDER BY created_at, id
     FOR UPDATE
  LOOP
    v_name := v_cat.name;
    v_n := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.categories
       WHERE user_id = v_owner AND name = v_name AND type = v_cat.type
    ) LOOP
      v_n := v_n + 1;
      v_name := left(v_cat.name, 100 - length(' ' || v_n)) || ' ' || v_n;
    END LOOP;
    UPDATE public.categories SET user_id = v_owner, name = v_name WHERE id = v_cat.id;
    v_moved := v_moved + 1;

    -- A renamed category is the surprise worth a notice; an unrenamed one keeps
    -- the name the owner already saw. Remembered here, told below.
    IF v_name <> v_cat.name THEN
      v_renamed_from := v_renamed_from || v_cat.name::text;
      v_renamed_to := v_renamed_to || v_name;
    END IF;
  END LOOP;

  -- Shared budgets: the personal-budget unique index is WHERE household_id IS
  -- NULL, so shared budgets cannot collide.
  UPDATE public.category_budgets SET user_id = v_owner
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_budgets = ROW_COUNT;

  UPDATE public.goals SET user_id = v_owner, updated_at = now()
   WHERE user_id = p_member AND household_id = p_household;
  GET DIAGNOSTICS v_goals = ROW_COUNT;

  v_moved := v_moved + v_budgets + v_goals;

  -- The owner's notices, OFF THE CRITICAL PATH: a failure here - even the writer
  -- missing - rolls back these notices alone and is recorded (section 3).
  IF p_cause IS NOT NULL THEN
    BEGIN
      v_kind := 'category_renamed';
      FOR v_i IN 1 .. coalesce(array_length(v_renamed_from, 1), 0) LOOP
        PERFORM private.record_account_notice(
          v_owner, 'category_renamed', p_cause, p_household,
          jsonb_build_object('household', v_household_name,
                             'from', v_renamed_from[v_i], 'to', v_renamed_to[v_i]),
          v_departing
        );
      END LOOP;

      v_kind := 'shared_plans_received';
      IF v_budgets + v_goals > 0 THEN
        PERFORM private.record_account_notice(
          v_owner, 'shared_plans_received', p_cause, p_household,
          jsonb_build_object('household', v_household_name, 'goals', v_goals, 'budgets', v_budgets),
          v_departing
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_message := SQLERRM;
      BEGIN
        INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
        VALUES (CASE WHEN v_departing IS NULL THEN 'write' ELSE 'stage' END, v_kind, v_state);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
      END;
      RAISE WARNING 'owner notices not recorded (kind %): % (%)', v_kind, v_message, v_state;
    END;
  END IF;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION private.move_member_shared_objects(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.move_member_shared_objects(UUID, UUID, TEXT) FROM anon, authenticated;
COMMENT ON FUNCTION private.move_member_shared_objects(UUID, UUID, TEXT) IS
  'The single definition of where a departing member''s shared categories/budgets/goals go (the household owner), and the notices that tell the owner. p_cause: account_deleted (staged) | member_removed (written) | NULL (none).';

-- -----------------------------------------------------------------------------
-- 7. Removal, as ONE transaction: the move, its notices and the membership
--    delete commit together or not at all, so "a member was removed" is never
--    told about a removal that failed. A NOTICE failure is contained inside the
--    move (section 6): it never fails the removal.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_household_member(p_household UUID, p_member UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_moved INTEGER;
BEGIN
  SELECT created_by INTO v_owner FROM public.households WHERE id = p_household FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'household % does not exist', p_household USING ERRCODE = 'P0002';
  END IF;
  IF v_owner = p_member THEN
    RAISE EXCEPTION 'the owner cannot be removed from their household' USING ERRCODE = 'P0001';
  END IF;

  v_moved := private.move_member_shared_objects(p_household, p_member, 'member_removed');

  DELETE FROM public.household_members WHERE household_id = p_household AND user_id = p_member;
  IF NOT FOUND THEN
    -- Rolls back the move and its notices with it.
    RAISE EXCEPTION 'user % is not a member of household %', p_member, p_household
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID, UUID) TO service_role;
COMMENT ON FUNCTION public.remove_household_member(UUID, UUID) IS
  'removeMember''s single transaction: the shared objects to the owner (with the owner''s notices), then the membership delete. Any failure rolls back all of it. service_role only.';

-- The old two-step entry point keeps its exact signature and INTEGER return for
-- the code deployed before this migration (reassign, THEN a separate membership
-- delete). It records NO notices: that delete can still fail after it returns.
CREATE OR REPLACE FUNCTION public.reassign_member_shared_objects(p_household UUID, p_member UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN private.move_member_shared_objects(p_household, p_member, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) TO service_role;
COMMENT ON FUNCTION public.reassign_member_shared_objects(UUID, UUID) IS
  'Legacy two-step removal entry point (kept for code deployed before 20261125100000): private.move_member_shared_objects with no notices. New code calls remove_household_member. service_role only.';

-- -----------------------------------------------------------------------------
-- 8. The preparatory half of account deletion - unchanged rules, same return
--    keys - now STAGING the notices for the people who stay. The changes are
--    the critical path; every notice statement is in a guarded block.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household UUID;
  v_household_name TEXT;
  v_new_owner UUID;
  v_seniority BOOLEAN;
  v_transferred BOOLEAN := false;
  v_moved INTEGER := 0;
  v_copied INTEGER := 0;
  v_repointed INTEGER := 0;
  v_count INTEGER;
  v_target UUID;
  r RECORD;
  -- What was COPIED, to whom: two parallel arrays, appended to on the critical
  -- path (an append cannot fail) and turned into notices in a guarded block.
  v_copy_to UUID[] := '{}';
  v_copy_name TEXT[] := '{}';
  v_recipient UUID;
  v_names JSONB;
  v_state TEXT;
  v_message TEXT;
BEGIN
  -- (a) OWNERSHIP + (b) SHARED OBJECTS, per household the user belongs to.
  -- One household per user is enforced in the service; looping is defensive.
  FOR v_household IN
    SELECT household_id FROM public.household_members WHERE user_id = p_user
  LOOP
    PERFORM 1 FROM public.households WHERE id = v_household FOR UPDATE;

    IF EXISTS (SELECT 1 FROM public.households WHERE id = v_household AND created_by = p_user) THEN
      -- P1: the household continues under the longest-standing remaining member.
      SELECT user_id INTO v_new_owner
        FROM public.household_members
       WHERE household_id = v_household AND user_id <> p_user
       ORDER BY joined_at ASC NULLS LAST, user_id ASC
       LIMIT 1;

      IF v_new_owner IS NOT NULL THEN
        UPDATE public.households SET created_by = v_new_owner, updated_at = now()
         WHERE id = v_household
         RETURNING name INTO v_household_name;
        UPDATE public.household_members SET role = 'admin'
         WHERE household_id = v_household AND user_id = v_new_owner;
        -- Keep "the admin IS the owner" true even if the auth delete is then
        -- refused: without this a failed deletion leaves a two-admin household,
        -- and "the admin" and created_by could name different people.
        UPDATE public.household_members SET role = 'member'
         WHERE household_id = v_household AND user_id = p_user;
        v_transferred := true;

        -- The new owner's notice, OFF THE CRITICAL PATH: everything it needs is
        -- computed in here, and a failure - even the writer missing - rolls back
        -- this block alone and is recorded (section 3).
        BEGIN
          -- "Longest-standing" is only KNOWN when every candidate has a join
          -- date; otherwise the pick fell back to id order and the text must not
          -- claim it. (joined_at is untouched by the role updates above.)
          v_seniority := NOT EXISTS (
            SELECT 1 FROM public.household_members
             WHERE household_id = v_household AND user_id <> p_user AND joined_at IS NULL
          );
          PERFORM private.record_account_notice(
            v_new_owner, 'household_transferred', 'account_deleted', v_household,
            jsonb_build_object('household', v_household_name, 'seniority', v_seniority),
            p_user
          );
        EXCEPTION WHEN OTHERS THEN
          v_state := SQLSTATE;
          v_message := SQLERRM;
          BEGIN
            INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
            VALUES ('stage', 'household_transferred', v_state);
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
          END;
          RAISE WARNING 'new-owner notice not staged: % (%)', v_message, v_state;
        END;
      END IF;
      -- Sole member: nothing to transfer. The auth.users cascade deletes the
      -- household, as before (P2).
    END IF;

    -- Creator (now a member of a household owned by someone else) or plain
    -- member alike: their shared objects go to the owner. Returns 0 for a sole
    -- member, who is still the owner.
    v_moved := v_moved + private.move_member_shared_objects(v_household, p_user, 'account_deleted');
  END LOOP;

  -- (c) P1 for categories: every category the user STILL owns that another
  -- user's row references is copied to that user - or that user's existing
  -- same name+type category is reused (same user, type and name IS the same
  -- category for them) - and their rows repointed. Without this the auth.users
  -- cascade either deletes those rows (category_budgets, value_categories),
  -- detaches them (wishlist_items), or is REFUSED by transactions.category_id
  -- ON DELETE RESTRICT.
  FOR r IN
    SELECT DISTINCT c.id AS cat_id, ref.user_id AS other_user,
           c.name, c.type, c.color, c.visibility_level
      FROM public.categories c
      JOIN (
        SELECT user_id, category_id FROM public.transactions WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.category_budgets WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.value_categories WHERE user_id <> p_user
        UNION
        SELECT user_id, category_id FROM public.wishlist_items
         WHERE user_id <> p_user AND category_id IS NOT NULL
      ) ref ON ref.category_id = c.id
     WHERE c.user_id = p_user
  LOOP
    SELECT id INTO v_target FROM public.categories
     WHERE user_id = r.other_user AND name = r.name AND type = r.type;
    IF v_target IS NULL THEN
      INSERT INTO public.categories (user_id, name, color, type, is_predefined, household_id, visibility_level)
      VALUES (r.other_user, r.name, r.color, r.type, false, NULL, r.visibility_level)
      RETURNING id INTO v_target;
      v_copied := v_copied + 1;
      -- Only a real COPY is reported: a reused same-name category was already theirs.
      v_copy_to := v_copy_to || r.other_user;
      v_copy_name := v_copy_name || r.name::text;
    END IF;

    UPDATE public.transactions SET category_id = v_target
     WHERE user_id = r.other_user AND category_id = r.cat_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    -- A personal budget for the same period on the target already exists ->
    -- leave this one; the user keeps an equivalent budget, and the duplicate
    -- goes with the deleted category.
    UPDATE public.category_budgets b SET category_id = v_target
     WHERE b.user_id = r.other_user AND b.category_id = r.cat_id
       AND NOT (b.household_id IS NULL AND EXISTS (
         SELECT 1 FROM public.category_budgets x
          WHERE x.user_id = r.other_user AND x.household_id IS NULL
            AND x.category_id = v_target AND x.period = b.period));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    -- value_categories is UNIQUE(value_id, category_id): skip a mapping that
    -- already exists on the target (it is the same mapping).
    UPDATE public.value_categories v SET category_id = v_target
     WHERE v.user_id = r.other_user AND v.category_id = r.cat_id
       AND NOT EXISTS (
         SELECT 1 FROM public.value_categories x
          WHERE x.value_id = v.value_id AND x.category_id = v_target);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;

    UPDATE public.wishlist_items SET category_id = v_target
     WHERE user_id = r.other_user AND category_id = r.cat_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_repointed := v_repointed + v_count;
  END LOOP;

  -- One notice per person who received copies: the names sorted and distinct,
  -- and whether they share a household with the person leaving ("a household
  -- member" is only claimed when they do). OFF THE CRITICAL PATH, as above.
  BEGIN
    FOR v_recipient, v_names IN
      SELECT t.recipient, jsonb_agg(DISTINCT t.name ORDER BY t.name)
        FROM unnest(v_copy_to, v_copy_name) AS t(recipient, name)
       GROUP BY t.recipient
       ORDER BY t.recipient
    LOOP
      PERFORM private.record_account_notice(
        v_recipient, 'categories_copied', 'account_deleted', NULL,
        jsonb_build_object(
          'categories', v_names,
          'shared_household', EXISTS (
            SELECT 1 FROM public.household_members a
              JOIN public.household_members b ON b.household_id = a.household_id
             WHERE a.user_id = p_user AND b.user_id = v_recipient
          )
        ),
        p_user
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
    v_message := SQLERRM;
    BEGIN
      INSERT INTO private.account_notice_failures (stage, kind, sqlstate)
      VALUES ('stage', 'categories_copied', v_state);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'account notice failure could not be recorded: % (%)', SQLERRM, SQLSTATE;
    END;
    RAISE WARNING 'copied-categories notices not staged: % (%)', v_message, v_state;
  END;

  RETURN jsonb_build_object(
    'ownership_transferred', v_transferred,
    'shared_objects_moved', v_moved,
    'categories_copied', v_copied,
    'rows_repointed', v_repointed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_account_deletion(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(UUID) TO service_role;
COMMENT ON FUNCTION public.prepare_account_deletion(UUID) IS
  'Preparatory half of account deletion: transfers household ownership, moves shared objects, copies member-referenced categories, and STAGES the notices for the people who stay (published only if the auth delete happens). Non-destructive by design; call before admin.deleteUser. service_role only.';
