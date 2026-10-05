-- Revoke write grants from `anon` on every public table.
--
-- WHY. Supabase's default privileges grant table-wide rights to BOTH `anon` and
-- `authenticated` on new public tables, and grants are ADDITIVE, so a REVOKE
-- naming one role leaves the other intact. Measured in production 2026-10-04:
-- `anon` held table-wide INSERT, UPDATE on 24 of 26 public tables. Only
-- `notification_deliveries` and `user_profiles` were clean.
--
-- That includes the two tables the backlog cited as the examples of having done
-- this correctly:
--
--   036_user_achievements.sql:43   REVOKE UPDATE, DELETE ... FROM authenticated;
--   037_comeback_challenges.sql:35 REVOKE INSERT, UPDATE, DELETE ... FROM authenticated;
--
-- Both are server-derived lifecycle tables whose entire point is that they must
-- not be forgeable through PostgREST. Half the job was done, on the exemplars.
--
-- NOT A LIVE VULNERABILITY, AND THAT IS THE POINT. Verified behaviourally on
-- 2026-10-05 against production, as `anon`, with the publishable key and a
-- `user_id` that does not exist in `auth.users` (so the FK made a row impossible
-- to create regardless of the outcome):
--
--   POST /rest/v1/user_achievements      -> 42501 new row violates RLS policy
--   POST /rest/v1/comeback_challenges    -> 42501 new row violates RLS policy
--   POST /rest/v1/transactions           -> 42501 new row violates RLS policy
--
-- 42501 and not 23503: the rows never reached the foreign key, so RLS refused
-- them. The key itself was confirmed live first (`GET` returned `200 []`), so a
-- 401 could not masquerade as a denial.
--
-- So today these tables are protected by exactly ONE layer. This migration adds
-- the second. The reason to bother is the reason both 2026-09-24 vulnerabilities
-- existed: a single layer holds until someone adds a policy for an unrelated
-- reason, and then it does not, and nobody is looking that day.
--
-- SAFE TO APPLY: nothing writes as `anon`. Established 2026-10-05:
--   * both client factories (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
--     use the publishable key, but @supabase/ssr attaches the user's JWT, so the
--     role is `authenticated` after login and `anon` only before it;
--   * the `(auth)` route group — the only pre-login UI — makes ZERO PostgREST
--     table writes. It calls `supabase.auth.*` only, which is GoTrue, not
--     PostgREST;
--   * `user_profiles` rows are created by `on_auth_user_created`, an
--     AFTER INSERT trigger on `auth.users` running `handle_new_user()`, which is
--     SECURITY DEFINER and, since 038, has EXECUTE revoked from anon and
--     authenticated and granted only to supabase_auth_admin. SIGNUP DOES NOT
--     DEPEND ON AN ANON GRANT;
--   * `/api/analytics/track` returns 401 without a user, so its insert into
--     `analytics_events` always runs as `authenticated`;
--   * `exchange_rates_cache` has no application writer at all.
--
-- SELECT IS DELIBERATELY LEFT ALONE. The finding is about write grants. Revoking
-- anon SELECT is a larger behavioural change with its own verification, and
-- nothing here establishes it is safe.
--
-- THE TABLE LIST IS DERIVED FROM THE CATALOG, NOT TYPED. A hand-written list of
-- 24 names is a list that is wrong the next time a table is added, and wrong
-- silently.
--
-- IDEMPOTENT: REVOKE of a privilege that was never granted is a no-op.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', r.relname
    );
  END LOOP;
END $$;

-- Default privileges for tables created LATER. Without this the next migration
-- that creates a table re-introduces the same grant, and this file becomes a
-- one-off rather than a policy.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- ============================================================================
-- VERIFY AFTER APPLYING — PER TABLE, NOT A SPOT CHECK
-- ============================================================================
-- This touches ~24 tables, so the check should enumerate them. Expected result:
-- every row reads `anon_writes = -`, and `authenticated` is unchanged from
-- whatever each table's own migration set.
--
--   SELECT c.relname AS tbl,
--          coalesce(string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
--            FILTER (WHERE a.grantee::regrole::text = 'anon'
--                      AND a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')), '-')
--            AS anon_writes,
--          coalesce(string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
--            FILTER (WHERE a.grantee::regrole::text = 'authenticated'
--                      AND a.privilege_type IN ('INSERT','UPDATE','DELETE')), '-')
--            AS authenticated_writes
--   FROM pg_catalog.pg_class c
--   JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
--   LEFT JOIN LATERAL aclexplode(c.relacl) a ON true
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   GROUP BY c.relname
--   ORDER BY (anon_writes <> '-') DESC, c.relname;
--
-- And behaviourally, the same probe as above must still return 42501 rather than
-- starting to return 23503 — which would mean a policy, not a grant, had changed.
--
-- ============================================================================
-- SEQUENCING — READ THIS BEFORE MERGING
-- ============================================================================
-- MERGING THIS BEFORE IT IS APPLIED TURNS THE DRIFT CHECK RED, IN THE DANGEROUS
-- DIRECTION. The local stack would build WITHOUT these grants while production
-- still has them, so production would hold grant entries the migrations do not:
-- that is PRODUCTION_ONLY, which is a hard fail on the first run, not a pending
-- item that ages out.
--
-- So the order is: apply to production FIRST, then merge this file to record it
-- — the same sequence as #68. Not the other way round.
