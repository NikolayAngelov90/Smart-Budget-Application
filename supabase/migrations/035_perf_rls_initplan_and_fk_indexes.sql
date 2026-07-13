-- Migration 035: Production performance pass (2026-07-13)
--
-- 1) RLS initplan fix — Supabase performance advisor flagged 70 policies
--    (auth_rls_initplan WARN): a bare auth.uid() in USING/WITH CHECK is
--    re-evaluated FOR EVERY ROW scanned. Wrapping it as (select auth.uid())
--    turns it into a one-time InitPlan per query. This block rewrites every
--    public-schema policy mechanically (semantics identical), idempotently:
--    already-wrapped occurrences are left untouched, so re-running is a no-op.
--
-- 2) Covering indexes for the 6 unindexed foreign keys the advisor flagged
--    (FK cascade lookups — e.g. deleting a category scans transactions by
--    category_id, which the existing (user_id, category_id) index can't serve).
--
-- Verified after apply: advisor reports 0 auth_rls_initplan and
-- 0 unindexed_foreign_keys findings.

DO $$
DECLARE
  p record;
  cmd text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        replace(coalesce(qual, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%'
        OR replace(coalesce(with_check, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%'
      )
  LOOP
    cmd := 'ALTER POLICY ' || quote_ident(p.policyname) || ' ON public.' || quote_ident(p.tablename);
    IF p.qual IS NOT NULL THEN
      cmd := cmd || ' USING ('
        || replace(replace(replace(p.qual,
             '( SELECT auth.uid() AS uid)', '@WRAPPED@'),
             'auth.uid()', '( SELECT auth.uid() AS uid)'),
             '@WRAPPED@', '( SELECT auth.uid() AS uid)')
        || ')';
    END IF;
    IF p.with_check IS NOT NULL THEN
      cmd := cmd || ' WITH CHECK ('
        || replace(replace(replace(p.with_check,
             '( SELECT auth.uid() AS uid)', '@WRAPPED@'),
             'auth.uid()', '( SELECT auth.uid() AS uid)'),
             '@WRAPPED@', '( SELECT auth.uid() AS uid)')
        || ')';
    END IF;
    EXECUTE cmd;
  END LOOP;
END $$;

-- Covering indexes for unindexed foreign keys (advisor: unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_category_id ON public.category_budgets (category_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_category_id ON public.wishlist_items (category_id);
CREATE INDEX IF NOT EXISTS idx_personal_allowances_household_id ON public.personal_allowances (household_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_invited_by ON public.household_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_household_invitations_accepted_by ON public.household_invitations (accepted_by);
