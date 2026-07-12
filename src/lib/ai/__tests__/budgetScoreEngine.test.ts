/**
 * Budget Score Engine Tests — Story 15.2
 * Pure unit tests — no mocks needed.
 *
 * Fixed clock: 2026-07-15 (July has 31 days → monthProgress = 15/31 ≈ 0.4839).
 */

import {
  ADHERENCE_MAX,
  CONSISTENCY_MAX,
  DAILY_STREAK_CAP,
  WEEKLY_STREAK_CAP,
  MONTH_PROGRESS_FLOOR,
  computeBudgetScore,
  levelFor,
  type BudgetScoreInput,
} from '../budgetScoreEngine';
import type { Category, Goal, StreakState, Transaction } from '@/types/database.types';

const TODAY = new Date(2026, 6, 15); // 2026-07-15

function tx(categoryId: string, amount: number, date: string): Transaction {
  return { category_id: categoryId, amount, date, type: 'expense' } as Transaction;
}

function cat(id: string): Category {
  return { id, name: id, type: 'expense' } as Category;
}

function goal(current: number, target: number): Goal {
  return { current_amount: current, target_amount: target } as Goal;
}

function streak(overrides: Partial<StreakState> = {}): StreakState {
  return {
    current_streak: 15,
    longest_streak: 20,
    weekly_streak: 4,
    last_log_date: '2026-07-15', // same day as TODAY → alive
    last_log_week: '2026-W29',
    freeze_used_on: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<BudgetScoreInput> = {}): BudgetScoreInput {
  return {
    currentMonthTransactions: [],
    historicalTransactions: [],
    categories: [],
    explicitBudgets: new Map(),
    goals: [],
    streak: null,
    today: TODAY,
    ...overrides,
  };
}

describe('levelFor — band edges', () => {
  it.each([
    [0, 'beginner'],
    [24, 'beginner'],
    [25, 'building'],
    [49, 'building'],
    [50, 'steady'],
    [74, 'steady'],
    [75, 'strong'],
    [89, 'strong'],
    [90, 'master'],
    [100, 'master'],
  ] as const)('score %i → %s', (score, level) => {
    expect(levelFor(score)).toBe(level);
  });
});

describe('computeBudgetScore — no data', () => {
  it('returns null when nothing exists at all', () => {
    expect(computeBudgetScore(makeInput())).toBeNull();
  });
});

describe('adherence factor', () => {
  it('is unscored (and non-punishing) when no category has a resolvable budget', () => {
    // Activity exists (streak) but zero budgets/history → adherence unscored
    const result = computeBudgetScore(
      makeInput({ categories: [cat('c1')], streak: streak() })!
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.status).toBe('unscored');
    expect(adherence.earned).toBe(0);
  });

  it('scores 1.0 sub-score when projected spend is within the explicit budget', () => {
    // Spent 200 of 500 budget at ~48% of month → projected ~413 < 500 → full points
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 200, '2026-07-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(ADHERENCE_MAX);
    expect(adherence.status).toBe('helping');
  });

  it('scores 0 when projected spend reaches 1.5× the budget', () => {
    // Spent 400 of 200 budget mid-month → projected ~827 → ratio > 1.5 → 0 pts
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 400, '2026-07-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 200]]),
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(0);
    expect(adherence.status).toBe('hurting');
  });

  it('resolves the budget from the fixed ÷3 historical average when no explicit limit (ADR-025)', () => {
    // 3 months × 300 → average 300; spent 100 at ~48% → projected ~207 < 300 → full pts
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10')],
        historicalTransactions: [
          tx('c1', 300, '2026-04-10'),
          tx('c1', 300, '2026-05-10'),
          tx('c1', 300, '2026-06-10'),
        ],
        categories: [cat('c1')],
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(ADHERENCE_MAX);
  });

  it('single spike month divides by the fixed window, not months present', () => {
    // One 900 spike → ÷3 average = 300 (not 900). Spending 100 MTD stays within.
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10')],
        historicalTransactions: [tx('c1', 900, '2026-06-10')],
        categories: [cat('c1')],
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(ADHERENCE_MAX);
  });

  it('floors month progress at 10% so a day-1 purchase does not project ×31', () => {
    // Day 1 of July: raw progress 1/31 ≈ 0.032 → floored to 0.1.
    // Spent 40 of 500 → projected 400 (not 1240) → within budget → full pts.
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 40, '2026-07-01')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
        today: new Date(2026, 6, 1),
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(ADHERENCE_MAX);
    expect(MONTH_PROGRESS_FLOOR).toBe(0.1);
  });

  it('averages sub-scores across budgeted categories', () => {
    // c1 perfect (1.0), c2 blown (0) → mean 0.5 → 25 pts → neutral band
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10'), tx('c2', 900, '2026-07-10')],
        categories: [cat('c1'), cat('c2')],
        explicitBudgets: new Map([
          ['c1', 500],
          ['c2', 200],
        ]),
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(ADHERENCE_MAX / 2);
    expect(adherence.status).toBe('neutral');
  });
});

describe('consistency factor', () => {
  it('earns full points at the daily and weekly caps', () => {
    const result = computeBudgetScore(
      makeInput({
        streak: streak({ current_streak: DAILY_STREAK_CAP, weekly_streak: WEEKLY_STREAK_CAP }),
      })
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.earned).toBe(CONSISTENCY_MAX);
    expect(consistency.status).toBe('helping');
  });

  it('caps streaks beyond the caps (no bonus above 30d/8w)', () => {
    const result = computeBudgetScore(
      makeInput({ streak: streak({ current_streak: 365, weekly_streak: 52 }) })
    )!;
    expect(result.factors.find((f) => f.key === 'consistency')!.earned).toBe(CONSISTENCY_MAX);
  });

  it('a BROKEN streak earns 0 — same invariant as the badge hiding dead streaks', () => {
    // Last log 10 days before TODAY — unbridgeable
    const result = computeBudgetScore(
      makeInput({
        streak: streak({ current_streak: 20, weekly_streak: 5, last_log_date: '2026-07-05' }),
      })
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.earned).toBe(0);
    expect(consistency.status).toBe('hurting');
  });

  it('no streak row scores 0 (knowable absence), still scored not unscored', () => {
    const result = computeBudgetScore(
      makeInput({ goals: [goal(50, 100)] }) // activity via goals
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.status).toBe('hurting');
    expect(consistency.earned).toBe(0);
  });
});

describe('goals factor', () => {
  it('is unscored with no goals', () => {
    const result = computeBudgetScore(makeInput({ streak: streak() }))!;
    expect(result.factors.find((f) => f.key === 'goals')!.status).toBe('unscored');
  });

  it('averages progress across goals, capping each at 100%', () => {
    // 150/100 (capped 1) + 25/100 (0.25) → mean 0.625 → 12.5 pts → neutral
    const result = computeBudgetScore(
      makeInput({ streak: streak(), goals: [goal(150, 100), goal(25, 100)] })
    )!;
    const goals = result.factors.find((f) => f.key === 'goals')!;
    expect(goals.earned).toBe(12.5);
    expect(goals.status).toBe('neutral');
  });

  it('skips zero-target goals instead of dividing by zero', () => {
    const result = computeBudgetScore(makeInput({ streak: streak(), goals: [goal(10, 0)] }))!;
    expect(result.factors.find((f) => f.key === 'goals')!.status).toBe('unscored');
  });
});

describe('renormalization', () => {
  it('consistency-only user can reach 100 (no budgets, no goals)', () => {
    const result = computeBudgetScore(
      makeInput({
        streak: streak({ current_streak: DAILY_STREAK_CAP, weekly_streak: WEEKLY_STREAK_CAP }),
      })
    )!;
    expect(result.score).toBe(100);
    expect(result.level).toBe('master');
  });

  it('adherence + consistency renormalize over 80 when goals are unscored', () => {
    // Full adherence (50) + zero consistency (0) over max 80 → 63 → steady
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
      })
    )!;
    expect(result.score).toBe(63); // round(50/80×100)
    expect(result.level).toBe('steady');
  });

  it('all three factors sum over 100 when all scored', () => {
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
        streak: streak({ current_streak: DAILY_STREAK_CAP, weekly_streak: WEEKLY_STREAK_CAP }),
        goals: [goal(100, 100)],
      })
    )!;
    expect(result.score).toBe(100);
    expect(result.factors).toHaveLength(3);
    expect(result.factors.every((f) => f.status === 'helping')).toBe(true);
  });
});

describe('factor status thresholds', () => {
  it('helping at exactly 70% of max', () => {
    // 21/30 consistency = 70% → helping: current 24 → 16pts, weekly 4 → 5pts = 21
    const result = computeBudgetScore(
      makeInput({ streak: streak({ current_streak: 24, weekly_streak: 4 }) })
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.earned).toBe(21);
    expect(consistency.status).toBe('helping');
  });

  it('hurting strictly below 40% of max', () => {
    // current 9 → 6pts, weekly 2 → 2.5pts = 8.5/30 ≈ 28% → hurting
    const result = computeBudgetScore(
      makeInput({ streak: streak({ current_streak: 9, weekly_streak: 2 }) })
    )!;
    expect(result.factors.find((f) => f.key === 'consistency')!.status).toBe('hurting');
  });

  it('neutral at exactly 40%', () => {
    // 12/30 = 40%: current 12 → 8pts, weekly 3.2? — use goals instead: 8/20=40%
    const result = computeBudgetScore(
      makeInput({ streak: streak(), goals: [goal(40, 100)] })
    )!;
    const goals = result.factors.find((f) => f.key === 'goals')!;
    expect(goals.earned).toBe(8);
    expect(goals.status).toBe('neutral');
  });
});
