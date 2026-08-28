-- hp-8 — a durable "insights last generated" marker
--
-- WHY A COLUMN AND NOT A DERIVATION
--
-- `shouldTriggerGeneration` read a module-level Map. On a serverless cold start
-- that Map is empty, every user looked "never generated", and the 10-transaction
-- gate was skipped — so insights regenerated on essentially every transaction
-- POST. Three states (loading / never / generated-at-T) had been squeezed into
-- two, and the missing one defaulted to the expensive answer.
--
-- The obvious fix is MAX(insights.created_at). It works TODAY only because
-- generation deletes every row and reinserts, so each row's created_at IS the
-- last run. hp-10 replaces that with fingerprint + UPSERT precisely so rows
-- SURVIVE — after which a row created in August and refreshed in October still
-- reads August, the marker goes stale, and the cold-start bug returns silently.
-- A derivation that depends on a bug is borrowed, not free.
--
-- MAX(updated_at) fails for a second, independent reason: a run that produces
-- ZERO insights has no row to touch. generateInsights already handles that case
-- ("Update cache even if no insights generated"), because the marker tracks
-- RUNS, not rows. No row-derived value can represent a run that wrote no rows,
-- and users with sparse data — who generate nothing — are exactly the ones whose
-- gate would then clear forever.
--
-- WHY THE REVOKE IS NOT OPTIONAL
--
-- `user_profiles` carries a full owner UPDATE policy (auth.uid() = id), so any
-- column added here is writable by the user through PostgREST. Left open, a user
-- could set this marker to a future date and permanently suppress their own
-- insight generation, or to the epoch and force a regeneration on every POST.
-- This is server-derived lifecycle state; it follows the project's existing rule
-- for such state — service-role writes only.
--
-- Column-level UPDATE is revoked rather than trusting the policy. Note that
-- GRANTs in Postgres are ADDITIVE: a later `GRANT UPDATE ON user_profiles TO
-- authenticated` would silently restore write access to this column. An RLS
-- integration test asserts the revoke still holds, so that regression fails
-- loudly instead of quietly re-opening the forgery.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS insights_last_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_profiles.insights_last_generated_at IS
  'When insight generation last RAN for this user (not when any insight row was '
  'written). NULL means never. Server-derived: written by the service role only; '
  'UPDATE is revoked from authenticated so it cannot be forged via PostgREST.';

-- HOW THIS IS ENFORCED, AND WHY THE OBVIOUS VERSION DOES NOT WORK
--
-- The first attempt was:
--
--   REVOKE UPDATE (insights_last_generated_at) ON public.user_profiles FROM authenticated;
--
-- It does nothing, and CI proved it: the RLS test wrote 1970-01-01 to the column
-- as the row's owner and the value LANDED. In Postgres a TABLE-level
-- `GRANT UPDATE` covers every column, including ones added later, and revoking a
-- COLUMN-level privilege does not cancel it. Supabase grants table-level UPDATE
-- to `authenticated` by default, so the column was writable the moment it
-- existed.
--
-- The working shape is to revoke the table-wide grant and re-grant per column.
--
-- THIS ALSO CLOSES A PRE-EXISTING PRIVILEGE ESCALATION, unrelated to hp-8.
-- `user_profiles.analytics_viewer` is an ACCESS-CONTROL FLAG — the analytics
-- dashboard checks it server-side and 403s without it. Under the table-wide
-- grant, any user could PATCH `analytics_viewer: true` onto their own row
-- through PostgREST and let themselves in. The same escalation applied to a
-- DELETE-then-INSERT of their own profile row, which is why INSERT is narrowed
-- too.
--
-- The re-granted set is exactly what the app writes with the USER client:
--   settingsService  -> display_name, profile_picture_url, preferences
--   auth/callback    -> display_name
--   settingsService  -> INSERT (id, preferences) when a profile is missing
-- Everything else — analytics_viewer, insights_last_generated_at, created_at,
-- updated_at (set by the user_profiles_updated_at trigger) — is server-owned.

REVOKE UPDATE ON public.user_profiles FROM authenticated;
REVOKE UPDATE ON public.user_profiles FROM anon;
REVOKE INSERT ON public.user_profiles FROM authenticated;
REVOKE INSERT ON public.user_profiles FROM anon;

GRANT UPDATE (display_name, profile_picture_url, preferences)
  ON public.user_profiles TO authenticated;
GRANT INSERT (id, preferences)
  ON public.user_profiles TO authenticated;

-- SELECT is untouched: the marker is not secret, a client may want to show
-- "last refreshed", and narrowing reads here would break the profile screen.
-- Only writes are restricted. RLS still applies on top of all of this — policies
-- and column privileges are checked independently and both must pass.
