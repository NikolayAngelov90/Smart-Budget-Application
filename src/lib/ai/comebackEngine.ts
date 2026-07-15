/**
 * Comeback Engine — Story 15.4 (FR31)
 *
 * Pure eligibility + restore math for comeback challenges. No DB, no node
 * APIs, client-import-safe (house engine standard).
 *
 * The "previous streak" needs no snapshot infrastructure: when a streak dies,
 * nothing rewrites the streaks row until the next log — the stale row IS the
 * snapshot. Eligibility is therefore evaluated BEFORE the user's first new
 * log resets the row.
 *
 * One challenge per absence (AC5): the latest challenge — any status — must
 * have started on or before the stale last_log_date, i.e. belong to a
 * PREVIOUS absence. A challenge dismissed during the current gap sits after
 * last_log_date and blocks re-offers until the user logs again and lapses
 * anew.
 */

import { dayDiff, localDayKey } from './streakEngine';
import type { StreakState } from '@/types/database.types';

/** Days of logging inactivity that qualify as an absence */
export const INACTIVITY_DAYS = 7;
/** Transactions to log to complete the challenge */
export const TARGET_LOGS = 3;
/** Days the challenge stays open */
export const WINDOW_DAYS = 7;
/** Fraction of the previous streak restored on completion */
export const RESTORE_FRACTION = 0.5;

export function isEligibleForChallenge(
  streak: StreakState | null,
  latestChallenge: { started_at: string } | null,
  todayKey: string
): boolean {
  if (!streak || !streak.last_log_date || streak.current_streak < 1) return false;

  const gap = dayDiff(streak.last_log_date, todayKey);
  if (gap === null || gap < INACTIVITY_DAYS) return false;

  if (latestChallenge) {
    const challengeDay = localDayKey(new Date(latestChallenge.started_at));
    // Same-absence challenge (offered after the last log) blocks a re-offer
    if (challengeDay > streak.last_log_date) return false;
  }

  return true;
}

/**
 * Streak value written on completion:
 * min(previous, floor(previous × RESTORE_FRACTION) + rebuilt), min 1.
 * Never exceeds the lost streak (no dismiss/complete farming), never punishes
 * what the user already rebuilt during the challenge.
 */
export function restoredStreak(previousStreak: number, currentStreak: number): number {
  const restore = Math.floor(previousStreak * RESTORE_FRACTION) + Math.max(currentStreak, 0);
  return Math.max(1, Math.min(previousStreak, restore));
}
