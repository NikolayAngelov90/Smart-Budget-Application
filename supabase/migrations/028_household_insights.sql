-- Migration 028: Household-level AI insights data source (Story 13.10)
-- A date-bounded variant of household_category_totals (023) so the insight engine can
-- compare current-month vs previous-month spend per shared category. Same transparency
-- guarantees: membership-gated, shared + category_only only (private excluded), sums never
-- rows. The pure engine (src/lib/ai/householdInsightEngine.ts) turns these aggregates into
-- household-framed insights — so private data structurally never reaches it.
-- Date: 2026-06-07

CREATE OR REPLACE FUNCTION public.household_category_period_totals(
  p_household_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (category_id UUID, category_name TEXT, total NUMERIC)
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
    SELECT c.id, c.name::text,
           COALESCE(SUM(t.amount), 0)::numeric AS total
    FROM categories c
    LEFT JOIN transactions t
      ON t.category_id = c.id
     AND t.type = 'expense'
     AND t.date >= p_start
     AND t.date < p_end
    WHERE c.household_id = p_household_id
      AND c.visibility_level IN ('shared', 'category_only')
    GROUP BY c.id, c.name;
END;
$$;

COMMENT ON FUNCTION public.household_category_period_totals(UUID, DATE, DATE) IS 'Story 13.10: membership-gated per-category expense totals in [p_start, p_end) for shared + category_only categories (private excluded). Sums only, never rows.';
