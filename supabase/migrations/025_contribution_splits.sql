-- Migration 025: Income-proportional contribution splits (Story 13.7)
-- Each member sets a PERCENTAGE (never income). The household's shared-expense "pot"
-- (shared + category_only categories, same filter as household_category_totals) is
-- divided into fair shares from those percentages, and each member's actual contribution
-- is tracked against their fair share.
--
-- Privacy: no income is ever stored — only contribution_percentage. Percentages are
-- readable by co-members (household_members SELECT RLS already allows that), which is the
-- intended fairness transparency. Per-member contributed totals are exposed only via a
-- membership-gated SECURITY DEFINER aggregate (sums, never rows) — consistent with how
-- category_only totals are surfaced in migration 023.
-- Date: 2026-06-05

-- ============================================================================
-- COLUMN
-- ============================================================================

ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS contribution_percentage NUMERIC(5, 2)
    CHECK (contribution_percentage IS NULL OR (contribution_percentage >= 0 AND contribution_percentage <= 100));

-- ============================================================================
-- SECURITY DEFINER AGGREGATE — per-member contributions (sums, never rows)
-- ============================================================================

-- Returns, for each member of the household, their percentage and the total they've
-- contributed to the shared pot (their transactions in the household's shared +
-- category_only categories). Membership-gated. email is included so the UI can label
-- members (they invited each other by email — no new disclosure).
CREATE OR REPLACE FUNCTION public.household_contributions(p_household_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  contribution_percentage NUMERIC,
  contributed NUMERIC
)
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
    SELECT
      hm.user_id,
      u.email::text,
      hm.contribution_percentage,
      COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = hm.user_id
          AND t.household_id = p_household_id
          AND t.type = 'expense'
          AND c.visibility_level IN ('shared', 'category_only')
      ), 0)::numeric AS contributed
    FROM household_members hm
    JOIN auth.users u ON u.id = hm.user_id
    WHERE hm.household_id = p_household_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN household_members.contribution_percentage IS 'Story 13.7: member''s share of shared expenses (0–100). NULL = not configured. No income is ever stored.';
COMMENT ON FUNCTION public.household_contributions(UUID) IS 'Story 13.7: per-member percentage + contributed total to the shared pot (sums, never rows). Membership-gated.';
