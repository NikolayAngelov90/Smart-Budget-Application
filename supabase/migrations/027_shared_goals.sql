-- Migration 027: Shared household savings goals (Story 13.9)
-- Adds household_id to goals (shared goal when set) with dual-path SELECT RLS so members
-- can read shared goals; shared-goal writes go through the service role (RLS SELECT-only
-- pattern). Per-member breakdown via a membership-gated SECURITY DEFINER aggregate.
--
-- Also (revised product decision 2026-06-07): contributing to a goal logs a "Savings"
-- expense transaction so the spend shows as leaving the budget. transactions gains a
-- goal_contribution_id link (ON DELETE SET NULL — the expense is a real historical event;
-- deleting the contribution/goal keeps it, just unlinks).
-- Date: 2026-06-07

-- ============================================================================
-- goals.household_id + dual-path SELECT
-- ============================================================================

ALTER TABLE goals ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_goals_household ON goals(household_id);

-- Members can read shared goals; owner still reads their own (personal + shared they created).
-- Writes remain owner-only at the RLS layer — shared create/contribute go through the
-- service role with explicit is_household_member checks (Epic 13 pattern), so no
-- member-writable RLS path is opened (avoids the cross-household-injection class).
DROP POLICY IF EXISTS "Users can read own goals" ON goals;
CREATE POLICY "Users can read own goals"
  ON goals FOR SELECT
  USING (
    auth.uid() = user_id
    OR (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  );

-- ============================================================================
-- transactions.goal_contribution_id (Savings-link)
-- ============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS goal_contribution_id UUID REFERENCES goal_contributions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_goal_contribution ON transactions(goal_contribution_id);

-- ============================================================================
-- SECURITY DEFINER aggregate — per-member goal breakdown (sums, never rows)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.household_goal_breakdown(p_goal_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, contributed NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  SELECT household_id INTO v_household_id FROM goals WHERE id = p_goal_id;
  IF v_household_id IS NULL OR NOT public.is_household_member(v_household_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT hm.user_id,
           u.email::text,
           COALESCE((
             SELECT SUM(gc.amount)
             FROM goal_contributions gc
             WHERE gc.goal_id = p_goal_id AND gc.user_id = hm.user_id
           ), 0)::numeric AS contributed
    FROM household_members hm
    JOIN auth.users u ON u.id = hm.user_id
    WHERE hm.household_id = v_household_id;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN goals.household_id IS 'Set => shared household savings goal (Story 13.9); members can read it. NULL => personal.';
COMMENT ON COLUMN transactions.goal_contribution_id IS 'Story 13.9: links a Savings expense to the goal contribution that created it (ON DELETE SET NULL).';
COMMENT ON FUNCTION public.household_goal_breakdown(UUID) IS 'Story 13.9: per-member contributed totals for a shared goal (sums, never rows). Membership-gated.';
