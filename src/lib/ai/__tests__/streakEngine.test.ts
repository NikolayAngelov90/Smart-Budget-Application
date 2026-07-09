/**
 * Streak Engine Tests — Story 15.1
 * Pure unit tests — no mocks needed.
 *
 * Calendar anchors (verified): 2026-01-01 is a Thursday, so 2026-01-05 is a
 * Monday and ISO week 2026-W02 spans Jan 5–11; 2026-W01 spans Dec 29 2025 –
 * Jan 4 2026; 2025-12-28 (Sunday) is ISO 2025-W52.
 */

import { advanceStreak, isFreezeAvailable, isoWeekKey, localDayKey } from '../streakEngine';
import type { StreakState } from '@/types/database.types';

function makeState(overrides: Partial<StreakState> = {}): StreakState {
  return {
    current_streak: 3,
    longest_streak: 5,
    weekly_streak: 1,
    last_log_date: '2026-01-06',
    last_log_week: '2026-W02',
    freeze_used_on: null,
    ...overrides,
  };
}

describe('helpers', () => {
  it('localDayKey formats local dates as YYYY-MM-DD', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('isoWeekKey produces zero-padded ISO year-week keys', () => {
    expect(isoWeekKey(new Date(2026, 0, 5))).toBe('2026-W02'); // Monday
    expect(isoWeekKey(new Date(2026, 0, 4))).toBe('2026-W01'); // Sunday before
    expect(isoWeekKey(new Date(2025, 11, 30))).toBe('2026-W01'); // ISO year boundary
    expect(isoWeekKey(new Date(2025, 11, 28))).toBe('2025-W52');
  });
});

describe('advanceStreak — state machine', () => {
  it('starts a streak on the first ever log', () => {
    const { state, event } = advanceStreak(null, '2026-01-05');
    expect(event).toBe('started');
    expect(state).toEqual({
      current_streak: 1,
      longest_streak: 1,
      weekly_streak: 1,
      last_log_date: '2026-01-05',
      last_log_week: '2026-W02',
      freeze_used_on: null,
    });
  });

  it('is idempotent for same-day repeat logs (no freeze consumed)', () => {
    const prev = makeState();
    const { state, event } = advanceStreak(prev, '2026-01-06');
    expect(event).toBe('same_day');
    expect(state).toEqual(prev);
  });

  it('extends on the next consecutive day', () => {
    const { state, event } = advanceStreak(makeState(), '2026-01-07');
    expect(event).toBe('extended');
    expect(state.current_streak).toBe(4);
    expect(state.last_log_date).toBe('2026-01-07');
  });

  it('updates the longest-streak high-water mark', () => {
    const { state } = advanceStreak(makeState({ current_streak: 5, longest_streak: 5 }), '2026-01-07');
    expect(state.current_streak).toBe(6);
    expect(state.longest_streak).toBe(6);
  });

  it('auto-freezes across exactly one missed day when the freeze is available', () => {
    // last log Jan 6, missed Jan 7, logs Jan 8 → bridged
    const { state, event } = advanceStreak(makeState(), '2026-01-08');
    expect(event).toBe('frozen');
    expect(state.current_streak).toBe(4);
    expect(state.freeze_used_on).toBe('2026-01-08');
  });

  it('resets on a one-day gap when this week\'s freeze is already spent', () => {
    const prev = makeState({ last_log_date: '2026-01-08', freeze_used_on: '2026-01-08' });
    const { state, event } = advanceStreak(prev, '2026-01-10'); // gap: Jan 9 missed, same W02
    expect(event).toBe('reset');
    expect(state.current_streak).toBe(1);
    expect(state.longest_streak).toBe(5); // high-water preserved
  });

  it('freezes again in a NEW ISO week even though last week\'s freeze was spent', () => {
    // freeze consumed in W02; now logging Mon Jan 12 (W03) then gap to Jan 14
    const prev = makeState({
      last_log_date: '2026-01-12',
      last_log_week: '2026-W03',
      freeze_used_on: '2026-01-08', // W02
    });
    const { state, event } = advanceStreak(prev, '2026-01-14');
    expect(event).toBe('frozen');
    expect(state.freeze_used_on).toBe('2026-01-14');
  });

  it('resets on gaps longer than one missed day (freeze never bridges 2+)', () => {
    const { state, event } = advanceStreak(makeState(), '2026-01-09'); // Jan 7+8 missed
    expect(event).toBe('reset');
    expect(state.current_streak).toBe(1);
    expect(state.freeze_used_on).toBeNull(); // not consumed on a reset
  });

  it('never regresses on backdated log days', () => {
    const prev = makeState();
    const { state, event } = advanceStreak(prev, '2026-01-05');
    expect(event).toBe('same_day');
    expect(state).toEqual(prev);
  });

  it('rejects rollover garbage log days without moving the machine', () => {
    const prev = makeState();
    const { state, event } = advanceStreak(prev, '2026-13-40');
    expect(event).toBe('same_day');
    expect(state).toEqual(prev);
  });

  describe('weekly streak', () => {
    it('stays unchanged within the same ISO week', () => {
      const { state } = advanceStreak(makeState({ weekly_streak: 4 }), '2026-01-07');
      expect(state.weekly_streak).toBe(4);
    });

    it('increments when logging in the immediately-next ISO week', () => {
      // last log Tue Jan 6 (W02) → next log Mon Jan 12 (W03); daily resets, weekly extends
      const { state, event } = advanceStreak(makeState({ weekly_streak: 4 }), '2026-01-12');
      expect(event).toBe('reset'); // 5 days missed
      expect(state.current_streak).toBe(1);
      expect(state.weekly_streak).toBe(5);
    });

    it('resets when a whole ISO week is skipped', () => {
      const { state } = advanceStreak(makeState({ weekly_streak: 4 }), '2026-01-20'); // W04
      expect(state.weekly_streak).toBe(1);
    });

    it('handles the ISO year boundary as consecutive weeks', () => {
      // Sun 2025-12-28 is 2025-W52; Fri 2026-01-02 is 2026-W01 → consecutive
      const prev = makeState({
        last_log_date: '2025-12-28',
        last_log_week: '2025-W52',
        weekly_streak: 4,
      });
      const { state } = advanceStreak(prev, '2026-01-02');
      expect(state.weekly_streak).toBe(5);
      expect(state.last_log_week).toBe('2026-W01');
    });
  });
});

describe('isFreezeAvailable', () => {
  it('is available when never used', () => {
    expect(isFreezeAvailable(makeState({ freeze_used_on: null }), '2026-W02')).toBe(true);
  });

  it('is spent within the same ISO week and available the next', () => {
    const state = makeState({ freeze_used_on: '2026-01-08' }); // W02
    expect(isFreezeAvailable(state, '2026-W02')).toBe(false);
    expect(isFreezeAvailable(state, '2026-W03')).toBe(true);
  });

  it('does not lock the freeze forever on a garbage stored date', () => {
    expect(isFreezeAvailable(makeState({ freeze_used_on: 'garbage' }), '2026-W02')).toBe(true);
  });
});
