/**
 * @jest-environment node
 */

/**
 * Budget-limit recommendations — the last epic-14 ÷3 holdout.
 *
 * `recommendBudgetLimit` had no direct coverage: the only suite that referenced
 * it mocked it out. It also averaged over the months PRESENT while every other
 * baseline in the app (nudge, forecastEngine, recoveryPlanner) uses the fixed
 * ÷3 window — so a category with two months of history showed one "typical
 * monthly" figure here and a different one on the forecast card.
 *
 * Resolved by requiring the FULL window rather than by porting ÷3, which would
 * have recommended a 220 budget to someone who reliably spends 300. These pin
 * both halves: the guard, and the agreement it buys.
 */

import { recommendBudgetLimit } from '../insightRules';
import {
  AVERAGE_WINDOW_MONTHS,
  calculateMean,
  fixedWindowMonthlyAverage,
} from '../spendingAnalysis';
import type { InsightInsert, InsightMetadata, Transaction } from '@/types/database.types';

/** `metadata` is typed as `Json` on the row, so narrow it once here. */
const metaOf = (insight: InsightInsert | null): InsightMetadata =>
  insight!.metadata as InsightMetadata;

const USER = 'user-1';
const CATEGORY = 'cat-groceries';
/** Anchor month; all fixtures are built backwards from here. */
const NOW = new Date('2026-07-15T12:00:00');

let nextId = 0;

/** `spend[0]` is the current month, `spend[1]` the one before, and so on. */
function transactionsFor(spend: number[]): Transaction[] {
  const txs: Transaction[] = [];
  spend.forEach((total, monthsAgo) => {
    if (total <= 0) return;
    // Split across 3 days so the rule's "at least 5 transactions" floor is met
    // by any two months, keeping the month COUNT the only variable under test.
    const per = total / 3;
    for (let d = 0; d < 3; d++) {
      const month = new Date(NOW.getFullYear(), NOW.getMonth() - monthsAgo, 10 + d);
      txs.push({
        id: `tx-${nextId++}`,
        user_id: USER,
        category_id: CATEGORY,
        amount: per,
        type: 'expense',
        date: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(
          month.getDate()
        ).padStart(2, '0')}`,
        notes: null,
        currency: 'EUR',
        exchange_rate: null,
        household_id: null,
        allowance_id: null,
        goal_contribution_id: null,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      });
    }
  });
  return txs;
}

const run = (spend: number[], currentBudget?: number) =>
  recommendBudgetLimit({
    userId: USER,
    categoryId: CATEGORY,
    categoryName: 'Groceries',
    transactions: transactionsFor(spend),
    currentMonth: NOW,
    currency: 'EUR',
    ...(currentBudget !== undefined ? { currentBudget } : {}),
  });

beforeEach(() => {
  nextId = 0;
});

describe('the full window is required', () => {
  it('returns nothing with only two months of history', () => {
    // Previously this produced a recommendation and described it as a
    // "3-month average" — having divided by 2.
    expect(run([300, 300])).toBeNull();
  });

  it('recommends once the third month lands', () => {
    const insight = run([300, 300, 300]);

    expect(insight).not.toBeNull();
    // 300 average + 10% buffer.
    expect(metaOf(insight)).toMatchObject({ three_month_average: 300, recommended_budget: 330 });
  });

  it('names every month it analysed, and there are three', () => {
    const insight = run([300, 300, 300]);

    expect(metaOf(insight).months_analyzed).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('still declines when a month inside the window has no spend', () => {
    // A gap means the window is not actually full, however recent the data.
    expect(run([300, 0, 300])).toBeNull();
  });
});

describe('the two baselines agree', () => {
  it.each([
    [[300, 300, 300]],
    [[900, 100, 200]],
    [[50, 700, 250]],
  ])('mean and fixed window coincide for %j', (spend) => {
    // This is what requiring the full window buys: at exactly
    // AVERAGE_WINDOW_MONTHS buckets the two formulas are the same number, so
    // the insight card and the forecast card cannot print different "typical
    // monthly" figures for one category.
    expect(fixedWindowMonthlyAverage(spend)).toBeCloseTo(calculateMean(spend), 10);
  });

  it('is not a vacuous claim — they diverge below a full window', () => {
    // Guards the guard: if these were equal for two buckets too, the test above
    // would prove nothing about the guard.
    expect(fixedWindowMonthlyAverage([300, 300])).not.toBeCloseTo(calculateMean([300, 300]), 5);
  });

  it('does not under-budget a steady spender', () => {
    // The failure mode that porting ÷3 wholesale would have introduced: a
    // recommendation BELOW what the user reliably spends, flagged as overspend
    // every month thereafter.
    const insight = run([300, 300, 300]);

    expect(metaOf(insight).recommended_budget as number).toBeGreaterThan(300);
  });
});

describe('the copy matches the arithmetic', () => {
  it('describes a window of exactly AVERAGE_WINDOW_MONTHS', () => {
    const insight = run([300, 300, 300]);

    expect(AVERAGE_WINDOW_MONTHS).toBe(3);
    expect(metaOf(insight).calculation_explanation).toContain('3-month average');
    expect(metaOf(insight).months_analyzed).toHaveLength(AVERAGE_WINDOW_MONTHS);
  });

  it('quotes the same average it used', () => {
    const insight = run([900, 100, 200]);
    // (900 + 100 + 200) / 3
    expect(metaOf(insight).three_month_average).toBe(400);
    expect(insight!.description).toContain('400');
  });
});

describe('existing suppressions still hold', () => {
  it('stays quiet when the recommendation is tiny', () => {
    expect(run([15, 15, 15])).toBeNull();
  });

  it('stays quiet when the current budget is already close', () => {
    // 330 recommended vs a 320 budget — within 15%.
    expect(run([300, 300, 300], 320)).toBeNull();
  });

  it('speaks up when the current budget is well off', () => {
    expect(run([300, 300, 300], 100)).not.toBeNull();
  });
});
