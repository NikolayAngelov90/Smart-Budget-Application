-- Migration 036: Achievement unlocks (Story 15.3, FR30, ADR-012)
-- Persists ONLY unlocks — achievement definitions live in a typed code catalog
-- (documented ADR-012 deviation: conditions are code regardless, and names/
-- conditions must ship through the CI-enforced en/bg i18n pipeline).
-- Append-only: no UPDATE/DELETE policies — an unlock is forever.
-- RLS uses the (select auth.uid()) initplan form — the 035 perf baseline.
-- Date: 2026-07-13

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL CHECK (char_length(achievement_key) BETWEEN 1 AND 50),
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_key)
);

-- The table is REST-exposed with an INSERT policy, so the catalog whitelist
-- must live at the trust boundary too (15-3 review: service-layer validation
-- alone let any authenticated user self-award badges / insert unbounded junk
-- keys via PostgREST). Adding achievement #11 = one-line constraint swap.
ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_key_in_catalog;
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_key_in_catalog
  CHECK (achievement_key IN (
    'first_transaction', 'ten_transactions', 'hundred_transactions',
    'week_streak', 'month_streak', 'first_budget', 'first_goal',
    'goal_reached', 'score_steady', 'score_master'
  ));

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
CREATE POLICY "Users can view their own achievements"
  ON user_achievements FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own achievements" ON user_achievements;
CREATE POLICY "Users can insert their own achievements"
  ON user_achievements FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Explicit grants (032/033 lesson): SELECT + INSERT only — append-only surface
GRANT SELECT, INSERT ON user_achievements TO authenticated;
GRANT ALL ON user_achievements TO service_role;
