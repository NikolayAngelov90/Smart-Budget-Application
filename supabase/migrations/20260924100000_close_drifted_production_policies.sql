-- SECURITY FIX — TWO cross-household exposure paths were live in production.
-- Both are drift: production's policy/trigger set is not the one these migrations
-- define. Neither is reachable through the application; both are reachable
-- through the raw PostgREST endpoint with a normal signed-in session, and signup
-- is open in production.
--
-- WHY PARTS OF THIS LOOK LIKE DEAD CODE AND ARE NOT. The DROP statements target
-- policies that NO migration in this repository creates, and the CREATE
-- statements re-create objects that 023 already creates. Against the migration
-- history both read as no-ops. Against the live database they are not.
--
-- HOW THE DRIFT WAS FOUND (2026-09-24). Production's detected_subscriptions was
-- missing a `currency` column that 012's CREATE TABLE defines — proof that
-- supabase/migrations/ does not describe production. A full catalog diff
-- followed: production read through the management API, the migration-built
-- schema read from a stack CI raised from these files, compared as CATALOGS
-- rather than as a reading of SQL.
--
--   tables         identical (26 = 26)
--   columns        1 difference  (detected_subscriptions.currency)
--   table grants   identical on every table
--   column grants  1 difference, a consequence of the missing column
--   policies       4 tables differ; EVERY SELECT policy matches
--   functions      26 in migrations, 25 in production; 3 bodies differ
--   triggers       13 in migrations, 12 in production
--
-- The isolation primitives themselves are identical — private.is_household_member,
-- private.is_household_admin and private.category_visibility hash-match exactly.
-- The gaps are in what ENFORCES writes, not in what resolves reads.
--
-- ============================================================================
-- FINDING 1 — cross-household self-join (household_members)
-- ============================================================================
-- 020_households.sql drops "Users can join as themselves" and states the reason:
--
--     NO anon INSERT policy by design. A blanket `WITH CHECK (user_id =
--     auth.uid())` would let any authenticated user insert THEMSELVES into ANY
--     household_id (a cross-household breach — they could self-join as admin and
--     read all its data).
--
-- Production carried it anyway: INSERT, WITH CHECK (user_id = auth.uid()), RLS
-- enabled, `authenticated` and `anon` holding INSERT, and NOTHING constraining
-- household_id or role. Insert (household_id = any household, user_id = self,
-- role = 'admin') and private.is_household_member() then returns true, opening
-- every household-scoped SELECT on households, household_members, categories and
-- transactions.
--
-- FORENSICS BEFORE THE FIX: all three membership rows in production had
-- legitimate provenance — two creators, one accepted invitation, cross-checked
-- against household_invitations. No unexplained row. Not known to have been used.
--
-- SAFE TO DROP, CHECKED NOT ASSUMED: every INSERT into household_members and
-- households goes through createServiceRoleClient(), which bypasses RLS —
-- householdService.createHousehold and invitationService.acceptInvitation. No
-- client-side writes exist; other references are SELECTs. Joining and creating a
-- household keep working.

DROP POLICY IF EXISTS "Users can join as themselves" ON public.household_members;

-- Same class, benign (self-owned only). 020 removed it to stop direct-client
-- creation of orphan households; creation runs through the service role.
DROP POLICY IF EXISTS "Users can create a household they own" ON public.households;

-- ============================================================================
-- FINDING 2 — a household member could unprivate a co-member's category
-- ============================================================================
-- 023_transparency.sql creates enforce_category_visibility_owner() and the
-- trg_category_visibility_owner BEFORE UPDATE trigger on categories. Production
-- has NEITHER — no function, and no trigger on categories at all.
--
-- Without it the chain is:
--   1. categories UPDATE policy allows ANY household member to update ANY
--      non-predefined category in the household, and constrains nothing about
--      visibility_level:
--        USING (is_predefined = false AND (auth.uid() = user_id
--               OR (household_id IS NOT NULL
--                   AND private.is_household_member(household_id, auth.uid()))))
--   2. So a member sets a co-member's `private` category to `shared`.
--   3. The SELECT policy hides private categories from co-members — but only
--      WHILE they are private. Now it is readable, and so is its spending.
--
-- This is the guarantee the README advertises in its own words: "per-category
-- transparency — fully shared, totals-only, or private — enforced in the
-- database, not the UI." In production it was enforced in the UI only:
-- /api/categories/[id] already refuses a non-owner visibility change in
-- application code. The raw PostgREST path had nothing.
--
-- SAFE TO ADD, CHECKED NOT ASSUMED: the two code paths that write
-- visibility_level both survive this trigger. householdService.applyPreset uses
-- the service-role client, where auth.uid() IS NULL makes `OLD.user_id <>
-- auth.uid()` evaluate to NULL rather than true — exempt by construction, as
-- 023's own comment notes. /api/categories/[id] already enforces owner-only in
-- application code, so the trigger agrees with it rather than contradicting it.
--
-- Copied from 023 rather than reinvented, so the two converge instead of drifting
-- again. Schema-qualified for search_path safety (the 038 lesson).

CREATE OR REPLACE FUNCTION public.enforce_category_visibility_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility_level IS DISTINCT FROM OLD.visibility_level
     AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the category owner can change visibility_level';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_category_visibility_owner ON public.categories;
CREATE TRIGGER trg_category_visibility_owner
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_category_visibility_owner();

-- ============================================================================
-- NOT FIXED HERE — deliberately, because they are not security gaps
-- ============================================================================
-- The diff also found, and these belong to the schema-reconciliation decision
-- rather than to a hotfix:
--
--   detected_subscriptions.currency  — present in migrations, absent in
--     production. 012 uses CREATE TABLE IF NOT EXISTS, so if the table already
--     existed the whole CREATE was a no-op and the column was never added. The
--     write path sets `currency`, so every subscription-detection write has
--     probably always failed with 42703 — which explains an empty table across
--     every era and every cron schedule. NOT patched here: adding a NOT NULL
--     column to a live table is a separate decision.
--
--   insights  — migrations create "Service can insert insights for users" with
--     WITH CHECK (true) and a DELETE policy allowing auth.uid() IS NULL.
--     Production has neither. Here production is SAFER than the migrations, and
--     the migrations are what needs changing.
--
--   wishlist_items UPDATE  — production's WITH CHECK validates category
--     ownership; the migrations' does not. Production safer again.
--
--   3 function bodies differ (patch_user_preferences, record_feature_activity,
--     seed_user_categories). seed_user_categories additionally has
--     search_path pinned in production and UNPINNED in the migrations — so a
--     fresh apply would undo part of 038's hardening.
--
-- ============================================================================
-- VERIFICATION — run after applying. All three must hold.
-- ============================================================================
--
--   -- (1) expect ZERO rows
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public'
--     AND policyname IN ('Users can join as themselves',
--                        'Users can create a household they own');
--
--   -- (2) expect ONE row
--   SELECT c.relname, t.tgname FROM pg_trigger t
--   JOIN pg_class c ON c.oid=t.tgrelid
--   JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname='categories';
--
--   -- (3) expect household_members = 1 policy, households = 3
--   SELECT tablename, count(*) FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('household_members','households')
--   GROUP BY tablename;
