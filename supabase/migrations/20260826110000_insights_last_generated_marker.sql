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

-- SELECT stays available: the value is not secret, and a client may want to show
-- "last refreshed". Only writing is restricted.
REVOKE UPDATE (insights_last_generated_at) ON public.user_profiles FROM authenticated;
REVOKE UPDATE (insights_last_generated_at) ON public.user_profiles FROM anon;

-- INSERT is how the signup trigger creates the row; it does not set this column,
-- and a user inserting their own profile has no reason to. Revoked for the same
-- forgery reason as UPDATE.
REVOKE INSERT (insights_last_generated_at) ON public.user_profiles FROM authenticated;
REVOKE INSERT (insights_last_generated_at) ON public.user_profiles FROM anon;

-- Partial index: shouldTriggerGeneration reads this per user by primary key, so
-- no index is needed for the lookup itself. Deliberately not adding one.
