-- Migration 031: Values-based spending plan (Story 14.1)
-- Personal values + a many-to-many mapping of categories to values. Purely personal —
-- owner-only RLS on both tables (auth.uid() = user_id), like personal_allowances (024).
-- NOTE: the table is `user_values`, NOT `values` (`values` is a SQL reserved keyword).
-- Date: 2026-06-08

-- ============================================================================
-- user_values
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One value name per user (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_values_user_name ON user_values (user_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_user_values_user ON user_values (user_id);

DROP TRIGGER IF EXISTS update_user_values_updated_at ON user_values;
CREATE TRIGGER update_user_values_updated_at
  BEFORE UPDATE ON user_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own values" ON user_values;
CREATE POLICY "Users can view their own values"
  ON user_values FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own values" ON user_values;
CREATE POLICY "Users can insert their own values"
  ON user_values FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own values" ON user_values;
CREATE POLICY "Users can update their own values"
  ON user_values FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own values" ON user_values;
CREATE POLICY "Users can delete their own values"
  ON user_values FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- value_categories (many-to-many: a category maps to >=1 values)
-- ============================================================================

CREATE TABLE IF NOT EXISTS value_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Denormalized so RLS is a flat auth.uid() = user_id (no recursive join → no 42P17).
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  value_id UUID REFERENCES user_values(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (value_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_value_categories_value ON value_categories (value_id);
CREATE INDEX IF NOT EXISTS idx_value_categories_category ON value_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_value_categories_user ON value_categories (user_id);

ALTER TABLE value_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own value categories" ON value_categories;
CREATE POLICY "Users can view their own value categories"
  ON value_categories FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own value categories" ON value_categories;
CREATE POLICY "Users can insert their own value categories"
  ON value_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own value categories" ON value_categories;
CREATE POLICY "Users can delete their own value categories"
  ON value_categories FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_values IS 'Personal values for values-based budgeting (Story 14.1). Owner-only. priority ASC = higher priority.';
COMMENT ON TABLE value_categories IS 'Maps categories to values (many-to-many), Story 14.1. Owner-only via denormalized user_id.';
