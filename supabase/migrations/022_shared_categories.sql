-- Migration 022: Shared budget categories (Story 13.5)
-- Adds optional household_id to categories + transactions (ADR-010: shared items carry
-- user_id creator + household_id; personal items keep household_id NULL) and extends RLS
-- to a dual-path (owner OR household member) — the "fully shared" baseline that Story 13.4
-- will refine with visibility_level. Personal behavior is preserved: the household OR-path
-- is inert when household_id IS NULL.
-- Date: 2026-06-04

-- ============================================================================
-- COLUMNS + INDEXES
-- ============================================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);

-- ============================================================================
-- CATEGORIES RLS — dual-path (extends 001_initial_schema.sql policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (household_id IS NULL OR public.is_household_member(household_id, auth.uid()))
  );

-- Owner manages personal categories; any household member manages shared ones.
-- The is_predefined = false guard is preserved (seeded categories stay immutable).
DROP POLICY IF EXISTS "Users can update their own non-predefined categories" ON categories;
CREATE POLICY "Users can update their own non-predefined categories"
  ON categories FOR UPDATE
  USING (
    is_predefined = false
    AND (
      auth.uid() = user_id
      OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
    )
  )
  -- WITH CHECK: prevent moving a category into a household the user doesn't belong to.
  WITH CHECK (
    is_predefined = false
    AND (household_id IS NULL OR public.is_household_member(household_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete their own non-predefined categories" ON categories;
CREATE POLICY "Users can delete their own non-predefined categories"
  ON categories FOR DELETE
  USING (
    is_predefined = false
    AND (
      auth.uid() = user_id
      OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
    )
  );

-- ============================================================================
-- TRANSACTIONS RLS — extend SELECT only; writes stay owner-only
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );

-- INSERT/UPDATE stay owner-only, but MUST also validate household_id membership so a user
-- cannot inject/move a transaction into a household they don't belong to (cross-household
-- integrity, NFR11). DELETE remains owner-only (no value check needed).
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (household_id IS NULL OR public.is_household_member(household_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (household_id IS NULL OR public.is_household_member(household_id, auth.uid()))
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN categories.household_id IS 'Set => shared household category (Story 13.5). NULL => personal.';
COMMENT ON COLUMN transactions.household_id IS 'Set (server-derived from a shared category) => visible to household members (Story 13.5).';
