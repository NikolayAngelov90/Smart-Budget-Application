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
import { advanceStreak, isValidDayKey } from '@/lib/ai/streakEngine';
import { logger } from '@/lib/utils/logger';
import type { StreakAdvanceResult, StreakState } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
 * Compare-and-swap update: only writes if the row's last_log_date still matches
 * what we read — a concurrent writer (second device, midnight-straddling POSTs)
 * makes the CAS miss instead of being blindly overwritten (15-1 review).
 * Returns true when a row was updated.
 */
async function casUpdate(
  supabase: SupabaseClient,
  userId: string,
  expectedLastLogDate: string | null,
  state: StreakState
): Promise<boolean> {
  let query = supabase.from('streaks').update(state).eq('user_id', userId);
  query =
    expectedLastLogDate === null
      ? query.is('last_log_date', null)
      : query.eq('last_log_date', expectedLastLogDate);
  const { data, error } = await query.select('user_id');
  if (error) {
    logger.error('StreakService', `update failed: ${error.message}`);
    throw new Error('Failed to update streak');
  }
  return (data ?? []).length > 0;
}

/**
 * Story 15.4: comeback restore — raises current_streak to `restored` (never
 * lowers what the user rebuilt, never exceeds the longest-streak high-water
 * mark so the 034 CHECK cannot trip). CAS-guarded on last_log_date; on a miss
 * re-reads and retries once (a concurrent log only ever RAISES current, so
 * recomputing against the fresh row stays correct). Returns the written
 * current_streak, or the fresh row's value when no write was needed.
 */
export async function restoreStreak(userId: string, restored: number): Promise<number> {
  const supabase = await createClient();

  const apply = async (state: StreakState | null): Promise<number | null> => {
    if (!state) return null;
    const target = Math.min(state.longest_streak, Math.max(restored, state.current_streak));
    if (target <= state.current_streak) return state.current_streak; // nothing to raise
    const next: StreakState = { ...state, current_streak: target };
    return (await casUpdate(supabase, userId, state.last_log_date, next)) ? target : null;
  };

  const first = await apply(await getStreak(userId));
  if (first !== null) return first;

  // CAS miss (concurrent log advanced the row) — re-read and retry once
  const fresh = await getStreak(userId);
  const second = await apply(fresh);
  if (second !== null) return second;

  // Still racing or no row: report the freshest truth without fabricating
  const latest = await getStreak(userId);
  return latest?.current_streak ?? 0;
}

/**
 * Applies one log day to the user's streak (idempotent per day) and persists
 * the result. Returns the advanced state + what happened + the PRE-advance
 * state (`previous`, additive 15.4): the comeback snapshot when a returning
 * user's first action is a log — the advance destroys the stale row otherwise.
 */
export async function recordLogActivity(
  userId: string,
  logDayKey: string
): Promise<StreakAdvanceResult> {
  // Reject garbage keys up front — a bad key must never persist a junk row
  if (!isValidDayKey(logDayKey)) {
    throw new Error('Invalid log day key');
  }

  const supabase = await createClient();

  const current = await getStreak(userId);
  const result = advanceStreak(current, logDayKey);

  // Same-day repeats change nothing — skip the write entirely
  if (current && result.event === 'same_day') {
    return { ...result, previous: current };
  }

  if (current) {
    if (await casUpdate(supabase, userId, current.last_log_date, result.state)) {
      return { ...result, previous: current };
    }
    // CAS miss: someone advanced the row since our read — re-read and retry once
    const fresh = await getStreak(userId);
    const retried = advanceStreak(fresh, logDayKey);
    if (fresh && retried.event !== 'same_day') {
      if (await casUpdate(supabase, userId, fresh.last_log_date, retried.state)) {
        return { ...retried, previous: fresh };
      }
      // Still racing — the concurrent writer owns this day; report its state
      const latest = await getStreak(userId);
      return { state: latest ?? retried.state, event: 'same_day', previous: fresh };
    }
    return { ...retried, previous: fresh };
  }

  const { error } = await supabase.from('streaks').insert({ user_id: userId, ...result.state });
  if (error) {
    // 23505: concurrent first-log race on the UNIQUE(user_id) — the other
    // request created the row; re-read and re-apply once (budgetService lesson)
    if (error.code === '23505') {
      const raced = await getStreak(userId);
      if (!raced) {
        // Winner row vanished between conflict and re-read (e.g. deletion race):
        // one more insert attempt; never report a state the DB doesn't hold
        const retryInsert = advanceStreak(null, logDayKey);
        const { error: insertRetryError } = await supabase
          .from('streaks')
          .insert({ user_id: userId, ...retryInsert.state });
        if (insertRetryError) {
          logger.error('StreakService', `insert retry failed: ${insertRetryError.message}`);
          throw new Error('Failed to save streak');
        }
        return { ...retryInsert, previous: null };
      }
      const retried = advanceStreak(raced, logDayKey);
      if (retried.event !== 'same_day') {
        if (!(await casUpdate(supabase, userId, raced.last_log_date, retried.state))) {
          const latest = await getStreak(userId);
          return { state: latest ?? retried.state, event: 'same_day', previous: raced };
        }
      }
      return { ...retried, previous: raced };
    }
    logger.error('StreakService', `insert failed: ${error.message}`);
    throw new Error('Failed to save streak');
  }
  return { ...result, previous: null };
}
