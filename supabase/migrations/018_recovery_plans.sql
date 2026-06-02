-- Migration 018: Add recovery_plans table (Story 12.4 / FR4)
-- 30-Day Budget Recovery Plans.
-- "Exceeded budget" = current-month category spend > 3-month historical average
-- (no budget-limits table exists in the MVP — see architecture.md / insightService.ts:138).
-- The per-category recovery target is the historical MINIMUM monthly spend (realistic floor).
-- Date: 2026-06-02

CREATE TABLE IF NOT EXISTS public.recovery_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  targets JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recovery_plans IS '30-day budget recovery plans (Story 12.4 / FR4)';
COMMENT ON COLUMN public.recovery_plans.targets IS 'JSONB array of RecoveryTarget objects: per-category historical_avg, historical_min, monthly/weekly/daily targets';
COMMENT ON COLUMN public.recovery_plans.status IS 'active | completed | abandoned — one active plan per user';

-- Enable RLS
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own recovery plans
CREATE POLICY "Users can read own recovery plans"
  ON public.recovery_plans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery plans"
  ON public.recovery_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery plans"
  ON public.recovery_plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery plans"
  ON public.recovery_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recovery_plans_user_id
  ON public.recovery_plans (user_id);

CREATE INDEX IF NOT EXISTS idx_recovery_plans_user_status
  ON public.recovery_plans (user_id, status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_recovery_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recovery_plans_updated_at
  BEFORE UPDATE ON public.recovery_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recovery_plans_updated_at();
