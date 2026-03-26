-- Migration 012: Add detected_subscriptions table for Subscription Graveyard (ADR-014)
-- Story 11.2: Subscription Detection
-- Date: 2026-03-26

-- Create subscription_status enum
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'unused', 'dismissed', 'kept');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create subscription_frequency enum
DO $$ BEGIN
  CREATE TYPE public.subscription_frequency AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create detected_subscriptions table
CREATE TABLE IF NOT EXISTS public.detected_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  estimated_amount DECIMAL(12, 2) NOT NULL CHECK (estimated_amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  frequency public.subscription_frequency NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.detected_subscriptions IS 'Stores detected recurring subscription patterns from transaction analysis (ADR-014)';
COMMENT ON COLUMN public.detected_subscriptions.merchant_pattern IS 'Normalized merchant name or pattern identifying the subscription';
COMMENT ON COLUMN public.detected_subscriptions.estimated_amount IS 'Recurring charge amount (DECIMAL, never float)';
COMMENT ON COLUMN public.detected_subscriptions.currency IS 'ISO 4217 currency code from the source transactions';
COMMENT ON COLUMN public.detected_subscriptions.frequency IS 'Detected subscription frequency (weekly, monthly, quarterly, annual)';
COMMENT ON COLUMN public.detected_subscriptions.last_seen_at IS 'Timestamp of the last transaction matching this pattern';
COMMENT ON COLUMN public.detected_subscriptions.status IS 'Subscription lifecycle status: active, unused, dismissed, kept';

-- Enable RLS
ALTER TABLE public.detected_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own records
CREATE POLICY "Users can read own subscriptions"
  ON public.detected_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.detected_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.detected_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.detected_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_detected_subscriptions_user_id
  ON public.detected_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_detected_subscriptions_status
  ON public.detected_subscriptions (user_id, status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_detected_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_detected_subscriptions_updated_at
  BEFORE UPDATE ON public.detected_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_detected_subscriptions_updated_at();
