-- FILENAME NOTE: this file is named with a Supabase TIMESTAMP version
-- (20260731095504), not the `NNN_` prefix used by 001-040.
--
-- It has to match the version recorded in the remote
-- `supabase_migrations.schema_migrations` table. 001-040 were applied by hand
-- in the SQL editor, which records nothing, so the remote history is empty for
-- them. This one was applied through the Supabase MCP `apply_migration` tool,
-- which DOES record a row — and the "Supabase Preview" check then failed on
-- every push to main with "Remote migration versions not found in local
-- migrations directory" until the filename matched.
--
-- Migration 20260731095504: deferred notification delivery (DW-4)
--
-- The quiet-hours gate SUPPRESSED rather than deferred, and each cron matched
-- its cohort with an equality scan at one fixed instant. Together that turned a
-- mild preference into a permanent opt-out nobody agreed to:
--
--   * reengagement-push ran at 10:00 UTC daily. A user whose quiet window
--     covered that hour got ZERO re-engagement pushes, ever.
--   * weekly-digest ran Monday 08:00 UTC. Same shape, weekly.
--   * a missed cron run (deploy, incident) skipped that cohort permanently,
--     because the next run matched a different instant.
--
-- The fix needs somewhere to record that a user has already been served for a
-- period, so the cron can scan a WINDOW ("owed, not yet sent, not currently
-- quiet") instead of matching a moment. That is this table.

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'reengagement' | 'weekly_digest'. Text rather than an enum so a new
  -- notification kind does not need a migration to start deduplicating.
  kind TEXT NOT NULL,
  -- The period this delivery satisfies: a local day key ('2026-07-31') for
  -- daily kinds, an ISO week key ('2026-W31') for weekly ones. Comparing period
  -- keys rather than timestamps is what makes a rerun idempotent.
  period_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The idempotency guarantee. A scan window means several runs will see the
  -- same eligible user; only the first insert wins.
  CONSTRAINT notification_deliveries_unique UNIQUE (user_id, kind, period_key)
);

COMMENT ON TABLE public.notification_deliveries IS
  'DW-4: one row per (user, notification kind, period) that has been delivered. Lets a cron scan a window instead of matching a single instant, so a push landing in quiet hours is deferred rather than lost.';

-- The cron scans by kind + period; the uniqueness index does not serve that.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_kind_period
  ON public.notification_deliveries (kind, period_key);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Grants are ADDITIVE and Supabase grants ALL to `authenticated` on new tables
-- by default, so revoke before granting.
REVOKE ALL ON public.notification_deliveries FROM PUBLIC;
REVOKE ALL ON public.notification_deliveries FROM anon;
REVOKE ALL ON public.notification_deliveries FROM authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;

-- SELECT-only for the user. This is server-derived lifecycle state: a client
-- able to INSERT here could forge an "already sent" marker and silently
-- suppress its own notifications. Writes are service-role only, which is the
-- same rule the achievements and challenges tables follow.
DROP POLICY IF EXISTS "own deliveries are readable" ON public.notification_deliveries;
CREATE POLICY "own deliveries are readable"
  ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  -- initplan form, per the 035 RLS baseline.
  USING (user_id = (SELECT auth.uid()));
