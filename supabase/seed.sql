-- Smart Budget Application - Seed Data
-- Default categories to be created for each new user
-- Story 1.2: Supabase Project Setup and Database Schema
-- Date: 2025-11-15

-- NOTE: This script is a reference for default categories.
-- Actual seeding will be triggered on user signup via database function or application code.
-- The auth.uid() function only works in the context of an authenticated user session.

-- ============================================================================
-- DEFAULT EXPENSE CATEGORIES
-- ============================================================================
-- These categories will be created for each new user during signup/onboarding
-- is_predefined = true means users cannot delete these categories

-- Template for expense categories (to be executed per user):
-- INSERT INTO categories (user_id, name, color, type, is_predefined) VALUES
--   (auth.uid(), 'Dining', '#f56565', 'expense', true),
--   (auth.uid(), 'Transport', '#4299e1', 'expense', true),
--   (auth.uid(), 'Entertainment', '#9f7aea', 'expense', true),
--   (auth.uid(), 'Utilities', '#48bb78', 'expense', true),
--   (auth.uid(), 'Shopping', '#ed8936', 'expense', true),
--   (auth.uid(), 'Healthcare', '#38b2ac', 'expense', true),
--   (auth.uid(), 'Rent', '#e53e3e', 'expense', true);

-- ============================================================================
-- DEFAULT INCOME CATEGORIES
-- ============================================================================

-- Template for income categories (to be executed per user):
-- INSERT INTO categories (user_id, name, color, type, is_predefined) VALUES
--   (auth.uid(), 'Salary', '#38a169', 'income', true),
--   (auth.uid(), 'Freelance', '#4299e1', 'income', true),
--   (auth.uid(), 'Investment', '#9f7aea', 'income', true),
--   (auth.uid(), 'Gift', '#f56565', 'income', true);

-- ============================================================================
-- SEED FUNCTION (Alternative approach using database function)
-- ============================================================================
-- This function can be called after user signup to seed default categories

CREATE OR REPLACE FUNCTION seed_user_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Insert default expense categories
  INSERT INTO categories (user_id, name, color, type, is_predefined) VALUES
    (target_user_id, 'Dining', '#f56565', 'expense', true),
    (target_user_id, 'Transport', '#4299e1', 'expense', true),
    (target_user_id, 'Entertainment', '#9f7aea', 'expense', true),
    (target_user_id, 'Utilities', '#48bb78', 'expense', true),
    (target_user_id, 'Shopping', '#ed8936', 'expense', true),
    (target_user_id, 'Healthcare', '#38b2ac', 'expense', true),
    (target_user_id, 'Rent', '#e53e3e', 'expense', true),
    -- Insert default income categories
    (target_user_id, 'Salary', '#38a169', 'income', true),
    (target_user_id, 'Freelance', '#4299e1', 'income', true),
    (target_user_id, 'Investment', '#9f7aea', 'income', true),
    (target_user_id, 'Gift', '#f56565', 'income', true);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_user_categories IS 'Seeds default categories for a new user. Call this after user signup: SELECT seed_user_categories(user_id);';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- To seed categories for a new user:
-- 1. Via SQL: SELECT seed_user_categories('user-uuid-here');
-- 2. Via application code during signup (Story 2.1 or 4.1):
--    await supabase.rpc('seed_user_categories', { target_user_id: userId });
