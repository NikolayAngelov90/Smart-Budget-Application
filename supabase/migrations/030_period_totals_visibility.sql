-- Migration 030: household_category_period_totals now also returns visibility_level
-- (Combined-spending fix) — the shared dashboard's Combined Spending card was using the
-- all-time household_category_totals; it should show the CURRENT MONTH. It will switch to
-- this date-bounded RPC, but it needs visibility_level to keep the "total only" tag on
-- category_only rows. Adding a column to the RETURNS TABLE requires DROP + CREATE.
-- Same membership-gated, sums-only, private-excluded guarantees.
-- Date: 2026-06-07

DROP FUNCTION IF EXISTS public.household_category_period_totals(UUID, DATE, DATE);

CREATE FUNCTION public.household_category_period_totals(
  p_household_id UUID,
  p_start DATE,
  p_end DATE
)
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
    LEFT JOIN transactions t
      ON t.category_id = c.id
     AND t.type = 'expense'
     AND t.date >= p_start
     AND t.date < p_end
    WHERE c.household_id = p_household_id
      AND c.visibility_level IN ('shared', 'category_only')
    GROUP BY c.id, c.name, c.visibility_level;
END;
$$;

COMMENT ON FUNCTION public.household_category_period_totals(UUID, DATE, DATE) IS 'Story 13.10/13.8 fix: membership-gated per-category expense totals in [p_start, p_end) for shared + category_only categories (private excluded, sums only), incl. visibility_level.';
