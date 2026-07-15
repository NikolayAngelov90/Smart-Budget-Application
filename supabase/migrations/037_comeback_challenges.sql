-- Migration 037: Comeback challenges (Story 15.4, FR31) + Phoenix achievement
-- One row per challenge; at most ONE active per user (partial unique index —
-- concurrent create-on-read GETs race safely: loser gets 23505 and re-reads).
-- Progress is DERIVED from transactions.created_at (never stored) — see story.
-- RLS: owner-only SELECT; ALL WRITES are SERVICE-ROLE only (15-4 review HIGH:
-- INSERT/UPDATE grants let users forge instant-win challenges via PostgREST,
-- farming restores + fake Phoenix badges — Epic-13 house pattern applies:
-- writes service-role, RLS SELECT-only; routes authenticate then call the
-- service). Date: 2026-07-13 (write-hardening 2026-07-14)

CREATE TABLE IF NOT EXISTS comeback_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  target_count INT NOT NULL CHECK (target_count > 0),
  previous_streak INT NOT NULL CHECK (previous_streak >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comeback_one_active
  ON comeback_challenges (user_id) WHERE status = 'active';

ALTER TABLE comeback_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own comeback challenges" ON comeback_challenges;
CREATE POLICY "Users can view their own comeback challenges"
  ON comeback_challenges FOR SELECT USING ((select auth.uid()) = user_id);
-- No INSERT/UPDATE/DELETE policies: challenge state is server-derived only
DROP POLICY IF EXISTS "Users can insert their own comeback challenges" ON comeback_challenges;
DROP POLICY IF EXISTS "Users can update their own comeback challenges" ON comeback_challenges;

GRANT SELECT ON comeback_challenges TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON comeback_challenges FROM authenticated;
GRANT ALL ON comeback_challenges TO service_role;

-- Phoenix badge joins the achievement catalog (the 15-3 constraint-swap path)
ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_key_in_catalog;
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_key_in_catalog
  CHECK (achievement_key IN (
    'first_transaction', 'ten_transactions', 'hundred_transactions',
    'week_streak', 'month_streak', 'first_budget', 'first_goal',
    'goal_reached', 'score_steady', 'score_master', 'comeback'
  ));
