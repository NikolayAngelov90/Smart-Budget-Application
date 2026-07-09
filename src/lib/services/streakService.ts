/**
 * Streak Service — Story 15.1 (FR28)
 *
 * Reads and advances the caller's logging streak. Purely personal — every call
 * uses the AUTH-SCOPED client so the owner-only RLS (migration 034) is the
 * security boundary and is exercised in production (valuesService pattern).
 *
 * recordLogActivity is ENRICHMENT per the degradation policy
 * (docs/api-conventions.md#degradation-policy): callers treat failures as
 * non-fatal — a streak hiccup must never fail a transaction POST.
 */

import { createClient } from '@/lib/supabase/server';
import { advanceStreak } from '@/lib/ai/streakEngine';
import { logger } from '@/lib/utils/logger';
import type { StreakAdvanceResult, StreakState } from '@/types/database.types';

const STATE_COLUMNS =
  'current_streak, longest_streak, weekly_streak, last_log_date, last_log_week, freeze_used_on';

/** Returns the caller's streak state, or null before their first log. */
export async function getStreak(userId: string): Promise<StreakState | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('streaks')
    .select(STATE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('StreakService', `get failed: ${error.message}`);
    throw new Error('Failed to load streak');
  }
  return (data as StreakState | null) ?? null;
}

/**
 * Applies one log day to the user's streak (idempotent per day) and persists
 * the result. Returns the advanced state + what happened.
 */
export async function recordLogActivity(
  userId: string,
  logDayKey: string
): Promise<StreakAdvanceResult> {
  const supabase = await createClient();

  const current = await getStreak(userId);
  const result = advanceStreak(current, logDayKey);

  // Same-day repeats change nothing — skip the write entirely
  if (current && result.event === 'same_day') {
    return result;
  }

  if (current) {
    const { error } = await supabase
      .from('streaks')
      .update(result.state)
      .eq('user_id', userId);
    if (error) {
      logger.error('StreakService', `update failed: ${error.message}`);
      throw new Error('Failed to update streak');
    }
    return result;
  }

  const { error } = await supabase.from('streaks').insert({ user_id: userId, ...result.state });
  if (error) {
    // 23505: concurrent first-log race on the UNIQUE(user_id) — the other
    // request created the row; re-read and re-apply once (budgetService lesson)
    if (error.code === '23505') {
      const raced = await getStreak(userId);
      const retried = advanceStreak(raced, logDayKey);
      if (raced && retried.event !== 'same_day') {
        const { error: retryError } = await supabase
          .from('streaks')
          .update(retried.state)
          .eq('user_id', userId);
        if (retryError) {
          logger.error('StreakService', `retry update failed: ${retryError.message}`);
          throw new Error('Failed to update streak');
        }
      }
      return retried;
    }
    logger.error('StreakService', `insert failed: ${error.message}`);
    throw new Error('Failed to save streak');
  }
  return result;
}
