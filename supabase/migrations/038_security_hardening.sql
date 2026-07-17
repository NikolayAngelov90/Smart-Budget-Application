-- Migration 038: Security hardening pass (advisor backlog, 2026-07-17)
--
-- Clears the security-advisor WARN backlog (84 -> ~6):
--   1. pg_graphql_anon/authenticated_table_exposed (25+25): the app never uses
--      GraphQL (PostgREST only) — drop the extension. Re-enable any time with
--      CREATE EXTENSION pg_graphql if GraphiQL in Studio is ever wanted.
--   2. function_search_path_mutable (14): pin search_path = public.
--   3. anon_security_definer_function_executable (9): policy-internal helpers
--      move to a non-exposed `private` schema (13-4 lesson: authenticated
--      EXECUTE CANNOT be revoked from policy-internal helpers — policy eval
--      runs as the querying role, so relocation is the only advisor-clearing
--      fix). Their existing grants move with them, so TO-public policies that
--      call them behave identically for anon probes (empty results, no 42501).
--      API RPCs stay in public with anon/PUBLIC EXECUTE revoked.
--   4. authenticated_security_definer_function_executable (9 -> 5 residual):
--      handle_new_user locked to supabase_auth_admin; the 5 household_* RPCs
--      REMAIN authenticated-executable BY DESIGN (PostgREST-called, each is
--      membership-gated internally, SELECT-only aggregates) — accepted.
--   5. public_bucket_allows_listing (1): drop the public SELECT policy on
--      profile-pictures (public buckets serve objects via the CDN path
--      WITHOUT object RLS — the app uses getPublicUrl; the SELECT policy
--      only enabled anonymous LISTING). Owner-scoped SELECT added instead.
--   6. auth_leaked_password_protection (1): dashboard-only toggle (Auth ->
--      Passwords -> leaked password protection) — NOT fixable in SQL.
--
-- POLICY REFERENCES ARE OID-BASED: relocating helper functions does not break
-- existing policies. FUNCTION BODIES ARE TEXT and the five household_* RPCs
-- call the helper SCHEMA-QUALIFIED (public.is_household_member) — search_path
-- cannot redirect a qualified reference, so their bodies are requalified to
-- private.is_household_member in the same transaction (learned the hard way:
-- the first prod apply briefly broke all five RPCs until the rewrite below).

begin;

-- 1) Non-exposed schema for policy-internal SECURITY DEFINER helpers.
--    USAGE for the API roles is required: policy evaluation as anon or
--    authenticated resolves private.* functions at query time.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.is_household_member(uuid, uuid) set schema private;
alter function public.is_household_admin(uuid, uuid) set schema private;
alter function public.category_visibility(uuid) set schema private;

-- The five RPCs get private on their search_path (belt for any future
-- unqualified references) AND their bodies requalified: they call
-- public.is_household_member SCHEMA-QUALIFIED, which search_path cannot
-- redirect. CREATE OR REPLACE via pg_get_functiondef preserves options,
-- ownership, and grants.
alter function public.household_category_totals(uuid) set search_path = public, private;
alter function public.household_category_period_totals(uuid, date, date) set search_path = public, private;
alter function public.household_contributions(uuid) set search_path = public, private;
alter function public.household_goal_breakdown(uuid) set search_path = public, private;
alter function public.household_members_list(uuid) set search_path = public, private;

do $$
declare r record; newdef text;
begin
  for r in
    select p.oid from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'household_category_totals', 'household_category_period_totals',
        'household_contributions', 'household_goal_breakdown',
        'household_members_list'
      )
  loop
    newdef := replace(
      pg_get_functiondef(r.oid),
      'public.is_household_member(',
      'private.is_household_member('
    );
    execute newdef;
  end loop;
end $$;

-- 2) handle_new_user: fired by the auth.users trigger only — no API role may
--    call it. Explicit supabase_auth_admin grant so the trigger path never
--    depends on PUBLIC.
alter function public.handle_new_user() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 3) Pin search_path on every remaining flagged function (loop resolves the
--    exact signatures, so trigger helpers with parameters are covered too)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'avg_views_before_dismissal', 'detect_browser', 'detect_device_type',
        'generate_device_name', 'insights_time_to_dismiss', 'seed_user_categories',
        'update_detected_subscriptions_updated_at', 'update_goals_updated_at',
        'update_recovery_plans_updated_at', 'update_updated_at_column',
        'update_user_feature_state_updated_at', 'update_user_profiles_updated_at',
        'user_insight_dismissal_rate'
      )
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- 4) API-called functions: authenticated + service_role only, never anon.
--    Revoking PUBLIC drops the implicit grant, so re-grant the intended
--    callers explicitly (user_id_by_email already follows this model, 026).
revoke execute on function public.household_category_totals(uuid) from public, anon;
revoke execute on function public.household_category_period_totals(uuid, date, date) from public, anon;
revoke execute on function public.household_contributions(uuid) from public, anon;
revoke execute on function public.household_goal_breakdown(uuid) from public, anon;
revoke execute on function public.household_members_list(uuid) from public, anon;
revoke execute on function public.seed_user_categories(uuid) from public, anon;

grant execute on function public.household_category_totals(uuid) to authenticated, service_role;
grant execute on function public.household_category_period_totals(uuid, date, date) to authenticated, service_role;
grant execute on function public.household_contributions(uuid) to authenticated, service_role;
grant execute on function public.household_goal_breakdown(uuid) to authenticated, service_role;
grant execute on function public.household_members_list(uuid) to authenticated, service_role;
grant execute on function public.seed_user_categories(uuid) to authenticated, service_role;

-- 5) Storage: kill anonymous listing of the public bucket; avatars keep
--    rendering via the public-object CDN URL (bypasses object RLS)
drop policy if exists "Public read for profile pictures" on storage.objects;
create policy "Users can read own pictures" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 6) GraphQL: unused surface, remove wholesale
drop extension if exists pg_graphql;

commit;
