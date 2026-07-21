-- Migration 039: Progressive feature disclosure (Story 15.7, ADR-022)
--
-- The user_feature_state table (011) has been dormant since signup: a zeroed
-- row is created but nothing updates or reads it. 15.7 makes it live. This
-- migration adds last_active_date so days_active can be incremented once per
-- calendar day of logging activity without coupling to the streaks table.
--
-- RLS is already the 035 initplan baseline (owner-only SELECT/INSERT/UPDATE);
-- no policy changes needed. Idempotent — safe to re-run manually in prod.

ALTER TABLE public.user_feature_state
  ADD COLUMN IF NOT EXISTS last_active_date DATE;
