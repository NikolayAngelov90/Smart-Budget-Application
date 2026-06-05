-- Migration 024: Personal Allowance System (Story 13.6)
-- A personal allowance is a PRIVATE budget within a household — its amount and its
-- transactions are invisible to other members and excluded from shared calculations.
--
-- Two privacy guarantees, both at the data layer:
--   1. personal_allowances has OWNER-ONLY RLS (deliberately NO dual-path member OR-branch,
--      unlike categories/transactions in 022/023) — members cannot SELECT the amount.
--   2. Allowance transactions are inserted with household_id = NULL (server-enforced), so
--      the transactions SELECT policy's household OR-branch (023) is inert => owner-only,
--      and household_category_totals() (023) never sums them (it filters by household_id +
--      shared/category_only visibility). No change to 023 is required.
-- Date: 2026-06-05

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS personal_allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  monthly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One allowance per user per household (MVP).
  UNIQUE (user_id, household_id)
);

CREATE INDEX IF NOT EXISTS idx_personal_allowances_user ON personal_allowances(user_id);

-- Link a transaction to a personal allowance. ON DELETE SET NULL so deleting the allowance
-- keeps the (still-private) transaction history; the tag simply clears.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS allowance_id UUID REFERENCES personal_allowances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_allowance ON transactions(allowance_id);

-- ============================================================================
-- updated_at trigger (reuses update_updated_at_column from 001)
-- ============================================================================

DROP TRIGGER IF EXISTS update_personal_allowances_updated_at ON personal_allowances;
CREATE TRIGGER update_personal_allowances_updated_at
  BEFORE UPDATE ON personal_allowances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS — OWNER-ONLY (the privacy guarantee). No household member OR-branch.
-- ============================================================================

ALTER TABLE personal_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own allowance" ON personal_allowances;
CREATE POLICY "Users can view their own allowance"
  ON personal_allowances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own allowance" ON personal_allowances;
CREATE POLICY "Users can insert their own allowance"
  ON personal_allowances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own allowance" ON personal_allowances;
CREATE POLICY "Users can update their own allowance"
  ON personal_allowances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own allowance" ON personal_allowances;
CREATE POLICY "Users can delete their own allowance"
  ON personal_allowances FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE personal_allowances IS 'Private per-user budget within a household (Story 13.6). Owner-only RLS — invisible to other members.';
COMMENT ON COLUMN personal_allowances.monthly_amount IS 'Private monthly allowance budget. Never exposed to other household members.';
COMMENT ON COLUMN transactions.allowance_id IS 'Set => allowance (private) spending (Story 13.6). Such rows MUST have household_id NULL (server-enforced) so they stay owner-only and out of shared totals.';
