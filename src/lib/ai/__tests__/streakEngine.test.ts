/**
 * Streak Engine Tests — Story 15.1
 * Pure unit tests — no mocks needed.
 *
 * Calendar anchors (verified): 2026-01-01 is a Thursday, so 2026-01-05 is a
 * Monday and ISO week 2026-W02 spans Jan 5–11; 2026-W01 spans Dec 29 2025 –
 * Jan 4 2026; 2025-12-28 (Sunday) is ISO 2025-W52.
 */

import {
  advanceStreak,
  isFreezeAvailable,
  isStreakBroken,
  isValidDayKey,
  isoWeekKey,
  localDayKey,
  wasJustFrozen,
} from '../streakEngine';
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
    expect(state.freeze_used_on).toBe('2026-01-07'); // stamped on the MISSED day
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
    expect(state.freeze_used_on).toBe('2026-01-13'); // the missed day, in W03
  });

  it("charges the freeze to the MISSED day's week at an ISO week boundary", () => {
    // Last log Sun Jan 11 (W02), missed Mon Jan 12 (W03), logs Tue Jan 13 (W03).
    // The miss is in W03 — so W03's freeze is what gets spent, even though the
    // W02 freeze was already used on Jan 7.
    const prev = makeState({
      current_streak: 6,
      last_log_date: '2026-01-11',
      last_log_week: '2026-W02',
      freeze_used_on: '2026-01-07', // W02 freeze already spent
      weekly_streak: 2,
    });
    const { state, event } = advanceStreak(prev, '2026-01-13');
    expect(event).toBe('frozen'); // W03 freeze is fresh
    expect(state.freeze_used_on).toBe('2026-01-12'); // missed Monday, W03
    // And now the W03 freeze is spent for the rest of that week:
    expect(isFreezeAvailable(state, '2026-W03')).toBe(false);
  });

  it('does NOT double-bridge within one week after a boundary freeze', () => {
    // Freeze consumed on missed Mon Jan 12 (W03); miss Wed Jan 14, log Thu Jan 15
    // → still W03, freeze spent → reset (no week-boundary double-dip).
    const prev = makeState({
      current_streak: 7,
      last_log_date: '2026-01-13',
      last_log_week: '2026-W03',
      freeze_used_on: '2026-01-12', // W03
      weekly_streak: 3,
    });
    const { state, event } = advanceStreak(prev, '2026-01-15');
    expect(event).toBe('reset');
    expect(state.current_streak).toBe(1);
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

describe('DST transitions (EU: 2026-03-29 spring-forward, 2026-10-25 fall-back)', () => {
  it('treats the spring-forward day (23h) as consecutive', () => {
    const prev = makeState({
      last_log_date: '2026-03-28',
      last_log_week: '2026-W13',
    });
    const { event } = advanceStreak(prev, '2026-03-29');
    expect(event).toBe('extended');
  });

  it('treats the fall-back day (25h) as consecutive, not a 2-day gap', () => {
    const prev = makeState({
      last_log_date: '2026-10-24',
      last_log_week: '2026-W43',
    });
    const { event } = advanceStreak(prev, '2026-10-25');
    expect(event).toBe('extended'); // Math.round day-diff, never freeze/reset
  });
});

describe('isValidDayKey', () => {
  it('accepts real calendar days', () => {
    expect(isValidDayKey('2026-01-05')).toBe(true);
    expect(isValidDayKey('2024-02-29')).toBe(true); // leap day
  });

  it('rejects rollover and garbage keys', () => {
    expect(isValidDayKey('2026-13-40')).toBe(false);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('garbage')).toBe(false);
    expect(isValidDayKey('')).toBe(false);
  });
});

describe('isStreakBroken', () => {
  it('is not broken with no streak yet', () => {
    expect(isStreakBroken(null, '2026-01-08')).toBe(false);
    expect(isStreakBroken(makeState({ current_streak: 0 }), '2026-01-08')).toBe(false);
  });

  it('is alive same-day and next-day', () => {
    expect(isStreakBroken(makeState(), '2026-01-06')).toBe(false);
    expect(isStreakBroken(makeState(), '2026-01-07')).toBe(false);
  });

  it('one missed day is still bridgeable while the freeze is available', () => {
    expect(isStreakBroken(makeState(), '2026-01-08')).toBe(false);
  });

  it("one missed day is DEAD when the missed week's freeze is spent", () => {
    const state = makeState({ freeze_used_on: '2026-01-05' }); // W02 spent; miss Jan 7 (W02)
    expect(isStreakBroken(state, '2026-01-08')).toBe(true);
  });

  it('two or more missed days are always dead', () => {
    expect(isStreakBroken(makeState(), '2026-01-09')).toBe(true);
    expect(isStreakBroken(makeState(), '2026-02-06')).toBe(true);
  });
});

describe('wasJustFrozen', () => {
  it('is true when the last advance bridged the day before the last log', () => {
    expect(
      wasJustFrozen(makeState({ freeze_used_on: '2026-01-05', last_log_date: '2026-01-06' }))
    ).toBe(true);
  });

  it('is false for older freezes or none', () => {
    expect(
      wasJustFrozen(makeState({ freeze_used_on: '2026-01-02', last_log_date: '2026-01-06' }))
    ).toBe(false);
    expect(wasJustFrozen(makeState({ freeze_used_on: null }))).toBe(false);
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
