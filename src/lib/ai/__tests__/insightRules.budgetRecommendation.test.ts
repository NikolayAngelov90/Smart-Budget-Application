/**
 * @jest-environment node
 */

/**
 * Budget-limit recommendations — the epic-14 ÷3 holdout, second attempt.
 *
 * HP-2 raised the guard from 2 months to 3 and asserted that made the insight
 * card and the forecast card agree "by construction". The post-merge review
 * found that false, and this suite was part of why it was believed:
 *
 *   - `'the two baselines agree'` asserted
 *     `fixedWindowMonthlyAverage(x) ≈ calculateMean(x)` over the SAME array.
 *     That is a property of two pure functions — an arithmetic tautology. It
 *     never ran the two FEATURES over one transaction set, which is the only
 *     thing that could have caught the real defect.
 *   - every fixture was dated the 15th with all spend on days 10-12, so the
 *     current-month bucket was always complete. The bug only shows on days
 *     when it isn't.
 *
 * The real defect: the bucket loop started at `i = 0`, the CURRENT partial
 * month, while `forecastEngine` builds its baseline from completed months only.
 *
 * D1 (settled with Nikit): average the three COMPLETE months before this one.
 * These tests now vary the day of the month, which the old ones never did.
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

/**
 * `spend[0]` is the CURRENT month, `spend[1]` the month before, and so on —
 * unchanged, so the fixtures still read naturally. What matters now is that the
 * rule must ignore index 0 entirely.
 */
const run = (spend: number[], currentBudget?: number, asOf: Date = NOW) =>
  recommendBudgetLimit({
    userId: USER,
    categoryId: CATEGORY,
    categoryName: 'Groceries',
    transactions: transactionsFor(spend),
    currentMonth: asOf,
    currency: 'EUR',
    ...(currentBudget !== undefined ? { currentBudget } : {}),
  });

beforeEach(() => {
  nextId = 0;
});

describe('the current month is excluded', () => {
  // THE regression this suite exists for. Every case here would have passed
  // before the fix only because the old fixtures were all dated the 15th with
  // a fully-materialised current month.

  it.each([
    ['the 2nd, nothing logged yet', new Date('2026-07-02T12:00:00'), 0],
    ['the 10th, a little logged', new Date('2026-07-10T12:00:00'), 100],
    ['the 28th, most of a month logged', new Date('2026-07-28T12:00:00'), 280],
  ])('recommends the same figure on %s', (_label, asOf, currentSpend) => {
    const insight = run([currentSpend, 300, 300, 300], undefined, asOf);

    expect(insight).not.toBeNull();
    // Identical on every day of the month, because none of the three months it
    // averages is the one in progress.
    expect(metaOf(insight)).toMatchObject({
      three_month_average: 300,
      recommended_budget: 330,
    });
  });

  it('a spike in the current month cannot move the recommendation', () => {
    const calm = run([0, 300, 300, 300]);
    const spike = run([5000, 300, 300, 300]);

    expect(metaOf(spike).three_month_average).toBe(metaOf(calm).three_month_average);
  });

  it('no longer goes silent at the start of a month', () => {
    // The regression HP-2 introduced: with the current month empty the old
    // guard saw two buckets and returned null, so the recommendation vanished
    // for the first days of every month.
    expect(run([0, 300, 300, 300], undefined, new Date('2026-07-01T12:00:00'))).not.toBeNull();
  });

  it('names the three completed months, never the current one', () => {
    const insight = run([250, 300, 300, 300]);

    expect(metaOf(insight).months_analyzed).toEqual(['2026-06', '2026-05', '2026-04']);
    expect(metaOf(insight).months_analyzed).not.toContain('2026-07');
  });
});

describe('the full window is required', () => {
  it('returns nothing with only two completed months', () => {
    expect(run([300, 300, 300])).toBeNull();
  });

  it('recommends once the third completed month exists', () => {
    expect(run([300, 300, 300, 300])).not.toBeNull();
  });

  it('declines when a month inside the window has no spend', () => {
    // A gap means the window is not actually full, however recent the data.
    expect(run([300, 300, 0, 300])).toBeNull();
  });
});

describe('the two baselines agree', () => {
  // The old version of this block compared two pure functions over the same
  // array — true by arithmetic, and blind to the defect. What matters is that
  // the rule's published average matches the number `forecastEngine` derives
  // for the same category, which it computes as
  // `fixedWindowMonthlyAverage(completed monthly totals)`.

  it.each([
    [[300, 300, 300]],
    [[900, 100, 200]],
    [[50, 700, 250]],
  ])('matches the forecast baseline for completed months %j', (priorMonths) => {
    // Current-month spend deliberately non-zero and unlike the others: if the
    // rule ever readmits it, these stop matching.
    const insight = run([777, ...priorMonths]);

    const forecastBaseline = fixedWindowMonthlyAverage(priorMonths);

    expect(metaOf(insight).three_month_average).toBe(Math.round(forecastBaseline));
    expect(forecastBaseline).toBeCloseTo(calculateMean(priorMonths), 10);
  });

  it('is not vacuous — readmitting the current month would break it', () => {
    // Proves the assertion above has teeth: the number the rule reports differs
    // from what it would report if bucket 0 were included.
    const priorMonths = [300, 300, 300];
    const withCurrent = fixedWindowMonthlyAverage([777, ...priorMonths].slice(0, 3));

    expect(withCurrent).not.toBeCloseTo(fixedWindowMonthlyAverage(priorMonths), 5);
  });

  it('does not under-budget a steady spender', () => {
    const insight = run([120, 300, 300, 300]);

    expect(metaOf(insight).recommended_budget as number).toBeGreaterThan(300);
  });
});

describe('the copy matches the arithmetic', () => {
  it('describes a window of exactly AVERAGE_WINDOW_MONTHS', () => {
    const insight = run([100, 300, 300, 300]);

    expect(AVERAGE_WINDOW_MONTHS).toBe(3);
    expect(metaOf(insight).calculation_explanation).toContain('3-month average');
    expect(metaOf(insight).months_analyzed).toHaveLength(AVERAGE_WINDOW_MONTHS);
  });

  it('quotes the same average it used', () => {
    const insight = run([50, 900, 100, 200]);
    // (900 + 100 + 200) / 3 — the current month's 50 must not appear.
    expect(metaOf(insight).three_month_average).toBe(400);
    expect(insight!.description).toContain('400');
  });
});

describe('existing suppressions still hold', () => {
  it('stays quiet when the recommendation is tiny', () => {
    expect(run([15, 15, 15, 15])).toBeNull();
  });

  it('stays quiet when the current budget is already close', () => {
    // 330 recommended vs a 320 budget — within 15%.
    expect(run([300, 300, 300, 300], 320)).toBeNull();
  });

  it('speaks up when the current budget is well off', () => {
    expect(run([300, 300, 300, 300], 100)).not.toBeNull();
  });
});
