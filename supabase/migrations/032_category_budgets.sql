-- Migration 032: Category budgets (ADR-025, Option C)
-- Optional per-category monthly spending limits. When no row exists the app falls
-- back to the 3-month historical average (existing behavior) via budgetResolver.
-- Personal budgets only in v1: owner-only RLS like personal_allowances (024) and
-- user_values (031). household_id is reserved for shared household budgets (ADR-025
-- scope split) — always NULL for now, no member RLS branch until that ships.
-- Date: 2026-07-02

CREATE TABLE IF NOT EXISTS category_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly')),
  -- Strictly positive: a 0 budget would split surface behavior (over on the card,
  -- invisible to nudges/forecasts whose 0-baseline guard means "no signal").
  limit_amount NUMERIC(12,2) NOT NULL CHECK (limit_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One personal budget per user+category+period. Postgres UNIQUE treats NULLs as
-- distinct, so a plain UNIQUE(...) with household_id would allow duplicate personal
-- rows — enforce the personal slot with a partial unique index instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_budgets_personal
  ON category_budgets (user_id, category_id, period)
  WHERE household_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_category_budgets_lookup ON category_budgets (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_household ON category_budgets (household_id);

DROP TRIGGER IF EXISTS update_category_budgets_updated_at ON category_budgets;
CREATE TRIGGER update_category_budgets_updated_at
  BEFORE UPDATE ON category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own budgets" ON category_budgets;
CREATE POLICY "Users can view their own budgets"
  ON category_budgets FOR SELECT USING (auth.uid() = user_id);
-- WITH CHECK mirrors the app-layer rules so direct PostgREST callers can't inject
-- rows for foreign/income categories or arbitrary households (Epic-13 lesson:
-- extending SELECT is not enough — INSERT/UPDATE need their own membership guards).
-- v1 is personal-only, so household_id must be NULL.
DROP POLICY IF EXISTS "Users can insert their own budgets" ON category_budgets;
CREATE POLICY "Users can insert their own budgets"
  ON category_budgets FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND household_id IS NULL
    AND category_id IN (
      SELECT id FROM categories
      WHERE categories.user_id = auth.uid() AND categories.type = 'expense'
    )
  );
DROP POLICY IF EXISTS "Users can update their own budgets" ON category_budgets;
CREATE POLICY "Users can update their own budgets"
  ON category_budgets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND household_id IS NULL
    AND category_id IN (
      SELECT id FROM categories
      WHERE categories.user_id = auth.uid() AND categories.type = 'expense'
    )
  );
DROP POLICY IF EXISTS "Users can delete their own budgets" ON category_budgets;
CREATE POLICY "Users can delete their own budgets"
  ON category_budgets FOR DELETE USING (auth.uid() = user_id);

-- Explicit grants: Supabase CLI >= 2.106 no longer auto-exposes new public-schema
-- objects to the Data API roles (the reason rls.yml pins 2.105.0) — grant up front
-- so this table survives the eventual CLI unpin.
GRANT SELECT, INSERT, UPDATE, DELETE ON category_budgets TO authenticated;
GRANT ALL ON category_budgets TO service_role;
