/**
 * @jest-environment node
 */

/**
 * hp-10 — every high outlier gets its own insight.
 *
 * WHY THIS EXISTS. The fix for "dismissed insights come back" creates a new
 * problem the moment it works. `flagUnusualExpense` reduced its outliers to ONE
 * — the largest — and the engine has no knowledge of dismissal, correctly.
 *
 * Today that is harmless: dismiss the biggest, it returns next run, you keep
 * seeing it. After hp-10 the dismissal STICKS, the rule still selects the same
 * largest transaction every run, it upserts onto a dismissed row and renders
 * nothing — so a second genuine outlier in that category becomes PERMANENTLY
 * INVISIBLE. Dismissing the biggest unusual expense would silently mute the
 * category for the whole window. That is a worse outcome than the bug being
 * fixed, and it is caused by fixing it.
 *
 * Resolved by emitting one insight PER OUTLIER, each keyed on its own
 * transaction_id — which is what the fingerprint design already assumed. The
 * engine stays pure; dismissal is handled entirely by the row it lands on.
 *
 * UNCAPPED, on measured data. Across both real accounts the maximum in any one
 * category was 2, and per account 6 — against 5 emitted by the old one-per-
 * category rule. The whole volume cost of "nothing is ever hidden" was ONE extra
 * insight on the largest account.
 *
 * And the bound is structural, not just observed: sigma is computed over a set
 * that INCLUDES the outliers, so each large value raises its own threshold.
 * Shopping measured mean 98.46 with sigma 181.74 — the outlier itself put the
 * bar at ~462. A category cannot accumulate many 2-sigma outliers.
 */

import { flagUnusualExpense } from '@/lib/ai/insightRules';
import type { InsightInsert, InsightMetadata, Transaction } from '@/types/database.types';

const USER = 'user-1';
const CATEGORY = 'cat-shopping';
const NOW = new Date('2026-08-15T12:00:00');

let nextId = 0;
const txs = (amounts: number[]): Transaction[] =>
  amounts.map((amount) => ({
    id: `tx-${nextId++}`,
    user_id: USER,
    category_id: CATEGORY,
    amount,
    type: 'expense' as const,
    date: '2026-08-10',
    notes: null,
    currency: 'EUR',
    exchange_rate: null,
    household_id: null,
    allowance_id: null,
    goal_contribution_id: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  }));

const run = (transactions: Transaction[]) =>
  flagUnusualExpense({
    userId: USER,
    categoryId: CATEGORY,
    categoryName: 'Shopping',
    transactions,
    currency: 'EUR',
  });

const metaOf = (i: InsightInsert) => i.metadata as InsightMetadata;

/**
 * Twenty tight values plus two clear outliers. Deliberately many normals: two
 * similar outliers inflate sigma enough to mask each other in a small set, which
 * is the masking edge filed as part of hp-14. This fixture is sized so BOTH are
 * genuinely beyond 2 sigma, so the test measures emission rather than detection.
 */
const CLUSTER = Array(20).fill(85);
const TWO_OUTLIERS = [...CLUSTER, 300, 290];

describe('flagUnusualExpense emits one insight per outlier', () => {
  it('surfaces BOTH outliers, not only the largest', () => {
    // THE ACCEPTANCE TEST. Against the pre-hp-10 engine this returns a single
    // insight and fails here — which is how we know it is the right test.
    const insights = run(txs(TWO_OUTLIERS));

    expect(Array.isArray(insights)).toBe(true);
    const amounts = (insights as InsightInsert[]).map((i) => metaOf(i).transaction_amount);
    expect(amounts).toEqual(expect.arrayContaining([300, 290]));
    expect(insights).toHaveLength(2);
  });

  it('gives each outlier its own transaction_id, so dismissal is per-purchase', () => {
    const insights = run(txs(TWO_OUTLIERS)) as InsightInsert[];
    const ids = insights.map((i) => metaOf(i).transaction_id);

    expect(new Set(ids).size).toBe(insights.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('orders by deviation, most unusual first', () => {
    const insights = run(txs(TWO_OUTLIERS)) as InsightInsert[];
    const sigmas = insights.map((i) => Number(metaOf(i).std_devs_from_mean));

    expect(sigmas).toEqual([...sigmas].sort((a, b) => b - a));
  });

  it('still emits nothing for a low outlier (hp-12 holds)', () => {
    const insights = run(txs([...CLUSTER, 5]));
    expect(insights).toHaveLength(0);
  });

  it('returns an empty array below the 10-transaction floor', () => {
    expect(run(txs([85, 85, 85, 300]))).toHaveLength(0);
  });
});
