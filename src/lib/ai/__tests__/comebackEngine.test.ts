/**
 * Comeback Engine Tests — Story 15.4
 * Pure unit tests — no mocks needed.
 */

import {
  INACTIVITY_DAYS,
  RESTORE_FRACTION,
  isEligibleForChallenge,
  restoredStreak,
} from '../comebackEngine';
import type { StreakState } from '@/types/database.types';

function streak(lastLog: string, current = 10): StreakState {
  return {
    current_streak: current,
    longest_streak: Math.max(current, 10),
    weekly_streak: 2,
    last_log_date: lastLog,
    last_log_week: '2026-W27',
    freeze_used_on: null,
  };
}

const TODAY = '2026-07-13';

describe('isEligibleForChallenge', () => {
  it('requires a streak row with a last log', () => {
    expect(isEligibleForChallenge(null, null, TODAY)).toBe(false);
    expect(isEligibleForChallenge(streak('2026-07-06', 0), null, TODAY)).toBe(false);
  });

  it('a 1-day previous streak is enough (the 0-vs-1 boundary, both sides)', () => {
    expect(isEligibleForChallenge(streak('2026-07-06', 1), null, TODAY)).toBe(true);
  });

  it('gap edge: 6 days is not an absence, 7 is', () => {
    expect(isEligibleForChallenge(streak('2026-07-07'), null, TODAY)).toBe(false); // gap 6
    expect(isEligibleForChallenge(streak('2026-07-06'), null, TODAY)).toBe(true); // gap 7
    expect(INACTIVITY_DAYS).toBe(7);
  });

  it('long absences stay eligible', () => {
    expect(isEligibleForChallenge(streak('2026-05-01'), null, TODAY)).toBe(true);
  });

  it('one challenge per absence: a challenge from the CURRENT gap blocks re-offer', () => {
    // Last log Jul 1; challenge offered Jul 10 (during this gap) → not eligible
    const s = streak('2026-07-01');
    expect(
      isEligibleForChallenge(s, { started_at: '2026-07-10T08:00:00Z' }, TODAY)
    ).toBe(false);
  });

  it('a challenge from a PREVIOUS absence does not block', () => {
    // Old challenge in May; user logged again Jul 1; new 12-day gap → eligible
    const s = streak('2026-07-01');
    expect(
      isEligibleForChallenge(s, { started_at: '2026-05-20T08:00:00Z' }, TODAY)
    ).toBe(true);
  });

  it('rejects garbage last_log_date without judging', () => {
    expect(isEligibleForChallenge(streak('garbage'), null, TODAY)).toBe(false);
  });
});

describe('restoredStreak', () => {
  it('restores half the lost streak plus what was rebuilt, capped at the original', () => {
    expect(restoredStreak(20, 3)).toBe(13); // 10 + 3
    expect(restoredStreak(20, 15)).toBe(20); // capped at prev
    expect(RESTORE_FRACTION).toBe(0.5);
  });

  it('minimum 1 even for a 1-day previous streak', () => {
    expect(restoredStreak(1, 0)).toBe(1); // floor(0.5)=0 + 0 → clamped to 1
    expect(restoredStreak(1, 1)).toBe(1); // capped at prev
  });

  it('never lowers below what was rebuilt (cap only at previous)', () => {
    expect(restoredStreak(9, 4)).toBe(8); // 4 + 4
    expect(restoredStreak(3, 3)).toBe(3);
  });

  it('negative current is treated as zero', () => {
    expect(restoredStreak(10, -5)).toBe(5);
  });
});
