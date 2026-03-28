-- Migration 013: Add goals and goal_contributions tables (ADR-013)
-- Story 11.5: Savings Goals
-- Date: 2026-03-28

-- Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.goals IS 'User savings goals with target amounts and optional deadlines (ADR-013)';
COMMENT ON COLUMN public.goals.target_amount IS 'Target savings amount (DECIMAL, must be > 0)';
COMMENT ON COLUMN public.goals.current_amount IS 'Accumulated saved amount from contributions (DECIMAL, >= 0)';
COMMENT ON COLUMN public.goals.deadline IS 'Optional target completion date (DATE)';

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own goals
CREATE POLICY "Users can read own goals"
  ON public.goals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON public.goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON public.goals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_goals_user_id
  ON public.goals (user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_goals_updated_at();

-- ============================================================================
-- goal_contributions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.goal_contributions IS 'Individual contributions toward a savings goal (ADR-013)';
COMMENT ON COLUMN public.goal_contributions.amount IS 'Contribution amount (DECIMAL, must be > 0)';
COMMENT ON COLUMN public.goal_contributions.note IS 'Optional note describing the contribution';

-- Enable RLS
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own contributions"
  ON public.goal_contributions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contributions"
  ON public.goal_contributions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contributions"
  ON public.goal_contributions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id
  ON public.goal_contributions (goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id
  ON public.goal_contributions (user_id);
