-- Migration 011: Add user_feature_state table for progressive disclosure (ADR-022)
-- Story 11.1: Streamlined Onboarding Flow

-- Create user_feature_state table
CREATE TABLE IF NOT EXISTS public.user_feature_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  transactions_count INTEGER NOT NULL DEFAULT 0,
  days_active INTEGER NOT NULL DEFAULT 0,
  features_unlocked TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_feature_state ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only read their own record
CREATE POLICY "Users can read own feature state"
  ON public.user_feature_state
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: users can update their own record
CREATE POLICY "Users can update own feature state"
  ON public.user_feature_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policy: users can insert their own record
CREATE POLICY "Users can insert own feature state"
  ON public.user_feature_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_feature_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_feature_state_updated_at
  BEFORE UPDATE ON public.user_feature_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_feature_state_updated_at();
