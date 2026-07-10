-- Migration 034: Logging streaks (Story 15.1, FR28, ADR-012)
-- One row per user tracking daily/weekly logging streaks + the weekly streak
-- freeze. Gamification lives in its OWN table (ADR-012) so core financial
-- tables stay untouched and the 15-6 opt-out remains a pure UI gate.
-- Owner-only flat RLS like 031/032/033 — purely personal.
-- Date: 2026-07-02

CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  -- The engine maintains longest >= current; enforce the invariant at the DB too
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0 AND longest_streak >= current_streak),
  weekly_streak INTEGER NOT NULL DEFAULT 0 CHECK (weekly_streak >= 0),
  last_log_date DATE,
  -- ISO year-week key, e.g. '2026-W27' (kept as TEXT: lexicographic order == chronological)
  last_log_week TEXT,
  -- The log-day on which the weekly freeze was consumed; freeze availability =
  -- freeze_used_on IS NULL or its ISO week is before the current one (app logic)
  freeze_used_on DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_streaks_updated_at ON streaks;
CREATE TRIGGER update_streaks_updated_at
  BEFORE UPDATE ON streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own streak" ON streaks;
CREATE POLICY "Users can view their own streak"
  ON streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own streak" ON streaks;
CREATE POLICY "Users can insert their own streak"
  ON streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own streak" ON streaks;
CREATE POLICY "Users can update their own streak"
  ON streaks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own streak" ON streaks;
CREATE POLICY "Users can delete their own streak"
  ON streaks FOR DELETE USING (auth.uid() = user_id);

-- Explicit grants (032/033 lesson): Supabase CLI >= 2.106 no longer auto-exposes
-- new public-schema objects — grant up front so the table survives the CLI unpin.
GRANT SELECT, INSERT, UPDATE, DELETE ON streaks TO authenticated;
GRANT ALL ON streaks TO service_role;
