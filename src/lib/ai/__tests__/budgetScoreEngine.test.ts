/**
 * Budget Score Engine Tests — Story 15.2
 * Pure unit tests — no mocks needed.
 *
 * Fixed clock: 2026-07-15. Adherence scores ACTUAL MTD spend vs budget
 * (review decision 2026-07-13) — no pace projection.
 */

import {
  ADHERENCE_MAX,
  CONSISTENCY_MAX,
  DAILY_STREAK_CAP,
  WEEKLY_STREAK_CAP,
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

  it('scores 1.0 sub-score while actual spend is within the explicit budget', () => {
    // Spent 200 of 500 budget → ratio 0.4 → full points
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

  it('scores 0 when actual spend reaches 1.5× the budget', () => {
    // Spent 400 of 200 budget → ratio 2.0 → 0 pts
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
    // 3 months × 300 → average 300; spent 100 → ratio 0.33 → full pts
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

  it('skips zero-spend budgeted categories — dormant categories neither help nor hurt', () => {
    // c1 untouched (budget 500), c2 blown 3× (600 of 200) → only c2 counts → 0 pts,
    // not the diluted (1.0 + 0)/2 = 25 the free perfect sub-score would give
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c2', 600, '2026-07-10')],
        categories: [cat('c1'), cat('c2')],
        explicitBudgets: new Map([
          ['c1', 500],
          ['c2', 200],
        ]),
      })
    )!;
    const adherence = result.factors.find((f) => f.key === 'adherence')!;
    expect(adherence.earned).toBe(0);
    expect(adherence.status).toBe('hurting');
  });

  it('is unscored when budgets exist but nothing was spent this month', () => {
    // A lapsed month must not score perfect adherence for doing nothing
    const result = computeBudgetScore(
      makeInput({
        historicalTransactions: [tx('c1', 300, '2026-06-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
      })
    )!;
    expect(result.factors.find((f) => f.key === 'adherence')!.status).toBe('unscored');
  });

  it('averages sub-scores across active budgeted categories', () => {
    // c1 within budget (1.0), c2 blown 4.5× (0) → mean 0.5 → 25 pts → neutral band
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

  it('no streak row + transaction history scores 0 (knowable absence, not unscored)', () => {
    const result = computeBudgetScore(
      makeInput({ historicalTransactions: [tx('c1', 50, '2026-06-10')] })
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.status).toBe('hurting');
    expect(consistency.earned).toBe(0);
  });

  it('is UNSCORED for a user who has never logged anything (goals only)', () => {
    const result = computeBudgetScore(makeInput({ goals: [goal(50, 100)] }))!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.status).toBe('unscored');
  });

  it('is UNSCORED when streak state is unavailable — infra failure never punishes', () => {
    // Daily logger + full goals, but the streaks table errored (034 unapplied):
    // consistency must renormalize away, not score 0/"hurting"
    const result = computeBudgetScore(
      makeInput({
        currentMonthTransactions: [tx('c1', 100, '2026-07-10')],
        categories: [cat('c1')],
        explicitBudgets: new Map([['c1', 500]]),
        goals: [goal(100, 100)],
        streak: null,
        streakUnavailable: true,
      })
    )!;
    const consistency = result.factors.find((f) => f.key === 'consistency')!;
    expect(consistency.status).toBe('unscored');
    // Renormalized over adherence(50) + goals(20) only → perfect user stays 100
    expect(result.score).toBe(100);
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

  it('renormalizes over consistency + goals (50) when adherence is unscored', () => {
    // daily 15 → 10 pts + weekly 4 → 5 pts = 15/30; goal 50% → 10/20
    const result = computeBudgetScore(
      makeInput({ streak: streak(), goals: [goal(50, 100)] })
    )!;
    expect(result.factors.find((f) => f.key === 'adherence')!.status).toBe('unscored');
    expect(result.score).toBe(50); // round((15+10)/50×100)
    expect(result.level).toBe('steady');
  });

  it('returns null for a budget-set-but-never-logged user (docstring contract)', () => {
    // Explicit budget exists but zero txns/streak/goals → NO factor scored → null
    const result = computeBudgetScore(
      makeInput({ categories: [cat('c1')], explicitBudgets: new Map([['c1', 500]]) })
    );
    expect(result).toBeNull();
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
