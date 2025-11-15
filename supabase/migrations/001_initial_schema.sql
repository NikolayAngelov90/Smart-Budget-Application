-- Smart Budget Application - Initial Database Schema
-- Story 1.2: Supabase Project Setup and Database Schema
-- Date: 2025-11-15

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Transaction types enum
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

-- Insight types enum
CREATE TYPE insight_type AS ENUM (
  'spending_increase',
  'budget_recommendation',
  'unusual_expense',
  'positive_reinforcement'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color e.g., #f56565
  type transaction_type NOT NULL,
  is_predefined BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, type)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insights table
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type insight_type NOT NULL,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB, -- Additional data (category_id, amounts, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Categories indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(user_id, type);

-- Transactions indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);

-- Insights indexes
CREATE INDEX idx_insights_user_id ON insights(user_id, is_dismissed);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Categories RLS policies
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own non-predefined categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id AND is_predefined = false);

CREATE POLICY "Users can delete their own non-predefined categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id AND is_predefined = false);

-- Transactions RLS policies
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Insights RLS policies
CREATE POLICY "Users can view their own insights"
  ON insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
  ON insights FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger function for transactions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to transactions table
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE categories IS 'User-defined and predefined expense/income categories';
COMMENT ON TABLE transactions IS 'Financial transactions (income/expense) with amount, date, notes';
COMMENT ON TABLE insights IS 'AI-generated financial insights and recommendations';

COMMENT ON COLUMN categories.is_predefined IS 'If true, category cannot be deleted by user';
COMMENT ON COLUMN transactions.amount IS 'Transaction amount in currency units (e.g., USD)';
COMMENT ON COLUMN insights.metadata IS 'JSONB field storing insight-specific data (amounts, percentages, etc.)';
COMMENT ON COLUMN insights.priority IS 'Priority level 1-5, where 5 is highest priority';
