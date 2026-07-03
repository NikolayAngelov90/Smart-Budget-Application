-- Migration 033: Wishlist items (Story 14.3, FR15, ADR-013)
-- Personal wishlist with budget/goal impact computed at read time (never persisted).
-- Owner-only flat RLS like personal_allowances (024) / user_values (031) — purely
-- personal, no household branch. category_id is optional and ON DELETE SET NULL so
-- deleting a category degrades the item's impact instead of destroying the wish.
-- Date: 2026-07-02

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  -- Strictly positive (UX spec: "Price > 0"); NUMERIC(12,2) matches category_budgets.
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'purchased', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- (user_id, status) also serves plain user_id lookups as a prefix — one index suffices.
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_status ON wishlist_items (user_id, status);

DROP TRIGGER IF EXISTS update_wishlist_items_updated_at ON wishlist_items;
CREATE TRIGGER update_wishlist_items_updated_at
  BEFORE UPDATE ON wishlist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wishlist items" ON wishlist_items;
CREATE POLICY "Users can view their own wishlist items"
  ON wishlist_items FOR SELECT USING (auth.uid() = user_id);

-- WITH CHECK mirrors the app-layer rules (032 lesson): a linked category must be
-- the caller's own EXPENSE category — direct PostgREST callers can't attach a
-- foreign or income category. NULL category is fine (month-balance impact only).
DROP POLICY IF EXISTS "Users can insert their own wishlist items" ON wishlist_items;
CREATE POLICY "Users can insert their own wishlist items"
  ON wishlist_items FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      category_id IS NULL
      OR category_id IN (
        SELECT id FROM categories
        WHERE categories.user_id = auth.uid() AND categories.type = 'expense'
      )
    )
  );
-- UPDATE deliberately checks ownership ONLY. Re-validating category_id here would
-- brick status-only updates when a linked shared category is later reassigned to
-- the household admin (13-11 member removal) — RLS has no OLD/NEW to detect "column
-- unchanged". The INSERT policy fully guards category linkage; the app never
-- changes category_id on update, and a direct caller writing a foreign category id
-- only pollutes their own row (name/budget lookups elsewhere are owner-filtered).
DROP POLICY IF EXISTS "Users can update their own wishlist items" ON wishlist_items;
CREATE POLICY "Users can update their own wishlist items"
  ON wishlist_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own wishlist items" ON wishlist_items;
CREATE POLICY "Users can delete their own wishlist items"
  ON wishlist_items FOR DELETE USING (auth.uid() = user_id);

-- Explicit grants (032 lesson): Supabase CLI >= 2.106 no longer auto-exposes new
-- public-schema objects — grant up front so this table survives the CLI unpin.
GRANT SELECT, INSERT, UPDATE, DELETE ON wishlist_items TO authenticated;
GRANT ALL ON wishlist_items TO service_role;
