-- Migration 023: Transparency presets & per-category controls (Story 13.4)
-- Adds visibility_level to shared categories + preset to household_members, and refines
-- the dual-path SELECT RLS so: shared = members see rows; category_only = members see the
-- category (for totals) but NOT its transactions; private = owner only. The category_only
-- totals are exposed via a SECURITY DEFINER aggregate (sums, never rows). Write guards
-- (WITH CHECK membership) from migration 022 are intentionally left unchanged.
-- Date: 2026-06-04

-- ============================================================================
-- ENUM + COLUMNS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE visibility_level AS ENUM ('shared', 'category_only', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS visibility_level visibility_level NOT NULL DEFAULT 'shared';

-- Transparency preset chosen by each member (informational + drives setup defaults).
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS preset TEXT CHECK (preset IN ('newlyweds', 'roommates', 'partners', 'custom'));

-- ============================================================================
-- SECURITY DEFINER HELPERS
-- ============================================================================

-- Reads a category's visibility level, bypassing RLS, so the transactions SELECT
-- policy can consult it without the member needing to SELECT the category row.
CREATE OR REPLACE FUNCTION public.category_visibility(p_category_id UUID)
RETURNS visibility_level
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT visibility_level FROM categories WHERE id = p_category_id;
$$;

-- Aggregate totals for a household's shared + category_only categories — sums only,
-- never individual rows. private categories are excluded. Membership-gated so only
-- members get results. Story 13.8 (shared dashboard) reuses this.
CREATE OR REPLACE FUNCTION public.household_category_totals(p_household_id UUID)
RETURNS TABLE (category_id UUID, category_name TEXT, visibility_level visibility_level, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_household_member(p_household_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT c.id, c.name::text, c.visibility_level,
           COALESCE(SUM(t.amount), 0)::numeric AS total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id
    WHERE c.household_id = p_household_id
      AND c.visibility_level IN ('shared', 'category_only')
    GROUP BY c.id, c.name, c.visibility_level;
END;
$$;

-- ============================================================================
-- OWNER-ONLY VISIBILITY (data-layer enforcement, NFR27 / AC#4)
-- ============================================================================
-- 13-5 lets any household member UPDATE a shared category (rename/recolor). Visibility
-- is the OWNER's privacy choice, so a member must not be able to change it via any path
-- (incl. the raw REST client). This trigger blocks a visibility_level change by anyone
-- other than the owner. Service-role writes (auth.uid() IS NULL — e.g. applyPreset) are
-- unaffected because `OLD.user_id <> NULL` evaluates to NULL (not true).
CREATE OR REPLACE FUNCTION public.enforce_category_visibility_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility_level IS DISTINCT FROM OLD.visibility_level
     AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the category owner can change visibility_level';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_category_visibility_owner ON categories;
CREATE TRIGGER trg_category_visibility_owner
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_category_visibility_owner();

-- ============================================================================
-- REFINED SELECT RLS (writes/INSERT/UPDATE WITH CHECK from 022 unchanged)
-- ============================================================================

-- categories: members see shared + category_only (for the total); never private.
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      household_id IS NOT NULL
      AND visibility_level <> 'private'
      AND public.is_household_member(household_id, auth.uid())
    )
  );

-- transactions: members see rows ONLY for shared categories; category_only + private
-- rows are hidden (their totals come from household_category_totals()).
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      household_id IS NOT NULL
      AND public.is_household_member(household_id, auth.uid())
      AND public.category_visibility(category_id) = 'shared'
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN categories.visibility_level IS 'Shared-category transparency (Story 13.4): shared=rows visible to members; category_only=total only; private=owner only.';
COMMENT ON COLUMN household_members.preset IS 'Transparency preset (Story 13.4): newlyweds/roommates/partners/custom. Sets per-category defaults; per-category override is authoritative.';
COMMENT ON FUNCTION public.household_category_totals(UUID) IS 'Member-gated aggregate totals for shared + category_only categories (sums, never rows). Excludes private. Reused by Story 13.8.';
