-- Migration 019: analytics_viewer role flag (Story 12.8)
-- Grants read access to the engagement analytics dashboard. Default false;
-- an admin grants it manually:
--   UPDATE public.user_profiles SET analytics_viewer = true WHERE id = '<user-uuid>';

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS analytics_viewer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.analytics_viewer IS
  'Grants read access to the engagement analytics dashboard (Story 12.8). Set manually by an admin.';
