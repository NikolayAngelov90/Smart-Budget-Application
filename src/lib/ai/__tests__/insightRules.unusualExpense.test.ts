/**
 * @jest-environment node
 */

/**
 * hp-12 — `unusual_expense` fired on LOW outliers and called them high.
 *
 * `isOutlier` measures |value - mean|, so it is two-sided by design. This rule
 * passed the result straight into hardcoded copy — "much higher than your
 * typical …" — with no branch on the sign, at priority 5, the most urgent voice
 * the product has. A real card read:
 *
 *     Unusual Dining expense: €13.72
 *     … much higher than your typical €34.00
 *     Deviation: -2.1 σ above average
 *
 * The metadata was honest (`std_devs_from_mean` is signed) while the sentence
 * above it was backwards. In a budgeting app, advice that is backwards is worse
 * than advice that is missing.
 *
 * Product decision (Nikit): this rule surfaces HIGH outliers only. An unusually
 * low spend is not an unusual expense; if it is ever worth surfacing it belongs
 * in positive_reinforcement with its own copy — NOT by branching this rule's
 * wording to "much lower", which would ship a critical-priority alert about
 * underspending.
 *
 * The function is pure and needs no mocking, which is why the absence of any
 * test for it was the whole problem: there were none before this file.
 */

import { flagUnusualExpense } from '../insightRules';
import { calculateMean, calculateStdDev } from '../spendingAnalysis';
import type { InsightInsert, InsightMetadata, Transaction } from '@/types/database.types';

const USER = 'user-1';
const CATEGORY = 'cat-dining';
const NOW = new Date('2026-07-15T12:00:00');

const metaOf = (insight: InsightInsert | null): InsightMetadata =>
  insight!.metadata as InsightMetadata;

let nextId = 0;

/** One transaction per amount; dates are irrelevant to this rule's statistics. */
function txs(amounts: number[]): Transaction[] {
  return amounts.map((amount) => ({
    id: `tx-${nextId++}`,
    user_id: USER,
    category_id: CATEGORY,
    amount,
    type: 'expense' as const,
    date: '2026-07-10',
    notes: null,
    currency: 'EUR',
    exchange_rate: null,
    household_id: null,
    allowance_id: null,
    goal_contribution_id: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  }));
}

const run = (amounts: number[]) =>
  flagUnusualExpense({
    userId: USER,
    categoryId: CATEGORY,
    categoryName: 'Dining',
    transactions: txs(amounts),
    currency: 'EUR',
  });

/**
 * Twelve values tightly clustered at 34, so one planted value dominates the
 * deviation. Ten is the rule's minimum sample size.
 */
const CLUSTER = [34, 34, 34, 33, 35, 34, 33, 35, 34, 34, 33, 35];

describe('flagUnusualExpense — direction', () => {
  it('does NOT fire on a transaction far BELOW the mean', () => {
    // The production card that exposed this: a low outlier described as high.
    const amounts = [...CLUSTER, 5];
    const mean = calculateMean(amounts);
    const stdDev = calculateStdDev(amounts, mean);

    // Guard the fixture itself: this MUST be a >2σ outlier, or the test would
    // pass for the boring reason that nothing was unusual at all.
    expect(Math.abs(5 - mean) / stdDev).toBeGreaterThan(2);
    expect(5).toBeLessThan(mean);

    expect(run(amounts)).toBeNull();
  });

  it('still fires on a transaction far ABOVE the mean', () => {
    const amounts = [...CLUSTER, 200];
    const insight = run(amounts);

    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('unusual_expense');
    expect(metaOf(insight).transaction_amount).toBe(200);
  });

  it('picks the HIGH outlier when a set contains both', () => {
    const amounts = [...CLUSTER, 5, 200];
    const insight = run(amounts);

    expect(insight).not.toBeNull();
    expect(metaOf(insight).transaction_amount).toBe(200);
  });

  it('never reports a negative deviation while claiming "higher"', () => {
    // The self-contradiction, asserted directly: whenever the rule speaks, its
    // own signed metadata must agree with the word it used.
    for (const amounts of [[...CLUSTER, 200], [...CLUSTER, 5, 200], [...CLUSTER, 120]]) {
      const insight = run(amounts);
      if (!insight) continue;
      expect(insight.description).toContain('higher');
      expect(metaOf(insight).std_devs_from_mean as number).toBeGreaterThan(0);
    }
  });

  it('returns null when a low outlier is the ONLY outlier', () => {
    // Distinct from the first case: several low outliers, none high. The rule
    // used to pick the largest of them and still say "higher".
    const insight = run([...CLUSTER, 4, 5, 6]);
    expect(insight).toBeNull();
  });
});

describe('flagUnusualExpense — unchanged behaviour', () => {
  it('needs at least 10 transactions', () => {
    expect(run([34, 34, 34, 200])).toBeNull();
  });

  it('returns null when every amount is identical (stdDev 0)', () => {
    expect(run(Array(12).fill(34))).toBeNull();
  });

  it('keeps the critical priority and signed metadata', () => {
    const insight = run([...CLUSTER, 200]);
    expect(insight!.priority).toBe(5);
    const meta = metaOf(insight);
    // The reported average INCLUDES the outlier: CLUSTER sums to 408 over 12
    // values, so (408 + 200) / 13 = 46.77 -> 47. Hand-computed on purpose —
    // deriving it with calculateMean would just restate the implementation.
    expect(meta.category_average).toBe(47);
    expect(meta.std_devs_from_mean as number).toBeGreaterThan(2);
  });
});
