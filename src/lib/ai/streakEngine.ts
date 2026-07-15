/**
 * Streak Engine — Story 15.1 (FR28)
 *
 * Pure state machine for daily/weekly logging streaks with the automatic
 * weekly streak freeze. Client-safe (no DB, no node APIs — the 14-4 precedent):
 * the dashboard runs it for the <100ms optimistic bump on transaction save,
 * and streakService runs the SAME code server-side for the source of truth.
 *
 * Freeze semantics (AC #2 conflict resolution): the UX spec mandates automatic,
 * no-guilt freezes ("no explicit check-in action"), so a 1-day gap auto-consumes
 * the weekly freeze when activity resumes — the UI reports it, never asks.
 */

import { getISOWeek, getISOWeekYear } from 'date-fns';
import type { StreakAdvanceResult, StreakState } from '@/types/database.types';

const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD DATE string as LOCAL midnight with round-trip rejection
 *  of rollover garbage like 2026-13-40 (14-2/14-3/14-4 lessons). */
function parseLocalDate(dateString: string): Date | null {
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** YYYY-MM-DD key for a Date in LOCAL time */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO year-week key, e.g. '2026-W27' — lexicographic order == chronological */
export function isoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
}

/** Whole-day difference between two YYYY-MM-DD keys (round: DST-safe; 14-4 lesson).
 *  Exported (additively, 15-4) for the comeback engine's inactivity-gap math. */
export function dayDiff(fromKey: string, toKey: string): number | null {
  const from = parseLocalDate(fromKey);
  const to = parseLocalDate(toKey);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** ISO week key for a YYYY-MM-DD day key, or null for garbage input */
function weekKeyForDay(dayKey: string): string | null {
  const date = parseLocalDate(dayKey);
  return date ? isoWeekKey(date) : null;
}

/** True when the key parses as a real YYYY-MM-DD calendar date */
export function isValidDayKey(dayKey: string): boolean {
  return parseLocalDate(dayKey) !== null;
}

/** Day key shifted by n days (n may be negative) */
function addDays(dayKey: string, n: number): string | null {
  const date = parseLocalDate(dayKey);
  if (!date) return null;
  return localDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + n));
}

/** The weekly freeze is available when never used or last used in an earlier ISO week */
export function isFreezeAvailable(state: StreakState, currentWeekKey: string): boolean {
  if (!state.freeze_used_on) return true;
  const usedWeek = weekKeyForDay(state.freeze_used_on);
  if (!usedWeek) return true; // garbage stored date — don't lock the freeze forever
  return usedWeek < currentWeekKey;
}

/**
 * Whether the most recent advance was a freeze bridge: the freeze stamps the
 * MISSED day, and the bridging log lands exactly one day after it.
 */
export function wasJustFrozen(state: StreakState): boolean {
  if (!state.freeze_used_on || !state.last_log_date) return false;
  return dayDiff(state.freeze_used_on, state.last_log_date) === 1;
}

/**
 * Whether the stored streak is already dead as of `todayKey` — i.e. the gap
 * since the last log can no longer be bridged (more than one missed day, or
 * exactly one missed day whose week's freeze is spent). The badge hides broken
 * streaks instead of showing a weeks-old count as if it were alive (15-1
 * review). A 1-missed-day gap with a freeze available is still ALIVE — that's
 * the freeze promise.
 */
export function isStreakBroken(state: StreakState | null, todayKey: string): boolean {
  if (!state || !state.last_log_date || state.current_streak <= 0) return false;
  const diff = dayDiff(state.last_log_date, todayKey);
  if (diff === null || diff <= 1) return false; // logged today/yesterday (or garbage input)
  if (diff === 2) {
    const missedDayKey = addDays(state.last_log_date, 1);
    const missedWeekKey = missedDayKey ? weekKeyForDay(missedDayKey) : null;
    return !(missedWeekKey && isFreezeAvailable(state, missedWeekKey));
  }
  return true;
}

const EMPTY_STATE: StreakState = {
  current_streak: 0,
  longest_streak: 0,
  weekly_streak: 0,
  last_log_date: null,
  last_log_week: null,
  freeze_used_on: null,
};

/**
 * Advances the streak state machine by one log day. Deterministic and
 * idempotent for repeat same-day logs. Never regresses on backdated input.
 */
export function advanceStreak(state: StreakState | null, logDayKey: string): StreakAdvanceResult {
  const prev = state ?? EMPTY_STATE;
  const logWeek = weekKeyForDay(logDayKey);

  // Garbage log day — refuse to move the machine (never fabricate a streak)
  if (!logWeek) {
    return { state: prev, event: 'same_day' };
  }

  // First ever log
  if (!prev.last_log_date) {
    const started: StreakState = {
      current_streak: 1,
      longest_streak: Math.max(prev.longest_streak, 1),
      weekly_streak: 1,
      last_log_date: logDayKey,
      last_log_week: logWeek,
      freeze_used_on: prev.freeze_used_on,
    };
    return { state: started, event: 'started' };
  }

  const diff = dayDiff(prev.last_log_date, logDayKey);

  // Same day (idempotent) / backdated or garbage stored date — never regress
  if (diff === null || diff <= 0) {
    return { state: prev, event: 'same_day' };
  }

  // Weekly streak: same ISO week keeps it; the immediately-next week extends it;
  // anything further restarts it. Week keys sort lexicographically, and the
  // "next week" check derives from the last log date + 7 days' week key.
  let weeklyStreak = prev.weekly_streak;
  if (prev.last_log_week === logWeek) {
    // unchanged
  } else {
    const lastDate = parseLocalDate(prev.last_log_date);
    const nextWeekKey = lastDate
      ? isoWeekKey(new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 7))
      : null;
    weeklyStreak = logWeek === nextWeekKey ? prev.weekly_streak + 1 : 1;
  }

  let currentStreak: number;
  let freezeUsedOn = prev.freeze_used_on;
  let event: StreakAdvanceResult['event'];

  // The freeze belongs to the week of the MISSED day, not the resume day —
  // otherwise a miss on Sunday charged to Monday's week both double-dips the
  // old week and steals the new week's freeze (15-1 review).
  const missedDayKey = diff === 2 ? addDays(prev.last_log_date, 1) : null;
  const missedWeekKey = missedDayKey ? weekKeyForDay(missedDayKey) : null;

  if (diff === 1) {
    currentStreak = prev.current_streak + 1;
    event = 'extended';
  } else if (diff === 2 && missedDayKey && missedWeekKey && isFreezeAvailable(prev, missedWeekKey)) {
    // Exactly one missed day, that week's freeze available → auto-bridge (no-guilt UX)
    currentStreak = prev.current_streak + 1;
    freezeUsedOn = missedDayKey;
    event = 'frozen';
  } else {
    // Longer gap, or that week's freeze is spent → fresh start (15.4 owns comebacks)
    currentStreak = 1;
    event = 'reset';
  }

  const next: StreakState = {
    current_streak: currentStreak,
    longest_streak: Math.max(prev.longest_streak, currentStreak),
    weekly_streak: weeklyStreak,
    last_log_date: logDayKey,
    last_log_week: logWeek,
    freeze_used_on: freezeUsedOn,
  };
  return { state: next, event };
}
