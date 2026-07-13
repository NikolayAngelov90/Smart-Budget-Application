/**
 * Achievement Engine Tests — Story 15.3
 * Pure unit tests — no mocks needed.
 *
 * Threshold edges are inclusive; missing (undefined) signals SKIP their
 * conditions entirely — unknowable ≠ 0 (the 15-2 HIGH lesson at engine level).
 */

import { evaluateAchievements } from '../achievementEngine';
import type { Goal, StreakState } from '@/types/database.types';

function streak(current: number): StreakState {
  return {
    current_streak: current,
    longest_streak: current,
    weekly_streak: 1,
    last_log_date: '2026-07-13',
    last_log_week: '2026-W29',
    freeze_used_on: null,
  };
}

function goal(current: number, target: number): Goal {
  return { current_amount: current, target_amount: target } as Goal;
}

const none = new Set<string>();

describe('evaluateAchievements — transaction counts', () => {
  it.each([
    [0, []],
    [1, ['first_transaction']],
    [9, ['first_transaction']],
    [10, ['first_transaction', 'ten_transactions']],
    [100, ['first_transaction', 'ten_transactions', 'hundred_transactions']],
  ])('%i transactions → %j', (count, expected) => {
    expect(evaluateAchievements({ transactionCount: count, alreadyUnlocked: none })).toEqual(
      expected
    );
  });

  it('undefined transactionCount skips count conditions entirely', () => {
    expect(evaluateAchievements({ alreadyUnlocked: none })).toEqual([]);
  });
});

describe('evaluateAchievements — streaks', () => {
  it.each([
    [6, []],
    [7, ['week_streak']],
    [29, ['week_streak']],
    [30, ['week_streak', 'month_streak']],
  ])('%i-day streak → %j', (days, expected) => {
    expect(evaluateAchievements({ streak: streak(days), alreadyUnlocked: none })).toEqual(expected);
  });

  it('null streak skips streak conditions (no row ≠ zero-day judgment)', () => {
    expect(evaluateAchievements({ streak: null, alreadyUnlocked: none })).toEqual([]);
  });
});

describe('evaluateAchievements — budgets and goals', () => {
  it('first_budget unlocks only when an explicit budget exists', () => {
    expect(evaluateAchievements({ hasBudget: true, alreadyUnlocked: none })).toEqual([
      'first_budget',
    ]);
    expect(evaluateAchievements({ hasBudget: false, alreadyUnlocked: none })).toEqual([]);
  });

  it('first_goal unlocks with any goal; goal_reached needs current >= target', () => {
    expect(evaluateAchievements({ goals: [goal(10, 100)], alreadyUnlocked: none })).toEqual([
      'first_goal',
    ]);
    expect(evaluateAchievements({ goals: [goal(100, 100)], alreadyUnlocked: none })).toEqual([
      'first_goal',
      'goal_reached',
    ]);
  });

  it('goal_reached guards against zero targets (never ÷0, never free unlock)', () => {
    expect(evaluateAchievements({ goals: [goal(10, 0)], alreadyUnlocked: none })).toEqual([
      'first_goal',
    ]);
  });

  it('empty goals array means no goal achievements (empty ≠ undefined only for first_goal)', () => {
    expect(evaluateAchievements({ goals: [], alreadyUnlocked: none })).toEqual([]);
  });
});

describe('evaluateAchievements — score', () => {
  it.each([
    [49, []],
    [50, ['score_steady']],
    [89, ['score_steady']],
    [90, ['score_steady', 'score_master']],
  ])('score %i → %j', (score, expected) => {
    expect(evaluateAchievements({ score, alreadyUnlocked: none })).toEqual(expected);
  });

  it('undefined score skips score conditions — a score outage must not lock OR unlock', () => {
    expect(evaluateAchievements({ score: undefined, alreadyUnlocked: none })).toEqual([]);
  });

  it('score 0 is a real score — evaluated, not skipped, and unlocks nothing', () => {
    expect(evaluateAchievements({ score: 0, alreadyUnlocked: none })).toEqual([]);
  });
});

describe('evaluateAchievements — alreadyUnlocked filtering', () => {
  it('returns only NEW keys', () => {
    const result = evaluateAchievements({
      transactionCount: 100,
      alreadyUnlocked: new Set(['first_transaction', 'ten_transactions']),
    });
    expect(result).toEqual(['hundred_transactions']);
  });

  it('returns empty when everything earned is already unlocked', () => {
    const result = evaluateAchievements({
      transactionCount: 1,
      alreadyUnlocked: new Set(['first_transaction']),
    });
    expect(result).toEqual([]);
  });

  it('emits in catalog order across mixed signals', () => {
    const result = evaluateAchievements({
      transactionCount: 10,
      streak: streak(7),
      hasBudget: true,
      goals: [goal(100, 100)],
      score: 90,
      alreadyUnlocked: none,
    });
    expect(result).toEqual([
      'first_transaction',
      'ten_transactions',
      'week_streak',
      'first_budget',
      'first_goal',
      'goal_reached',
      'score_steady',
      'score_master',
    ]);
  });
});
