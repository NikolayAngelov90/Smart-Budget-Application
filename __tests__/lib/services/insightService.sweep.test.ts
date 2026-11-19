/**
 * @jest-environment node
 */

/**
 * hp-10 — the write sequence: watermark, upsert, sweep.
 *
 * The RLS round-trip proves this works against a real Postgres. This proves the
 * SERVICE asks for the right things, which a database test cannot: that the
 * sweep carries `is_dismissed = false`, that its cutoff is the watermark READ
 * FROM THE DATABASE rather than a value the app invented, and that the upsert
 * names the composite conflict target.
 *
 * Filter ARGUMENTS are asserted, not just call counts. An arg-blind chain mock
 * lets a predicate disappear silently, and the predicate here is the fix: drop
 * `is_dismissed = false` and a dismissed row the rule no longer produces gets
 * deleted, so the run after that recreates it undismissed — hp-10 shipping the
 * original bug on a longer cycle.
 */

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createSupabaseMock, type SupabaseMock } from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/ai/insightRules', () => ({
  detectSpendingIncrease: jest.fn().mockReturnValue(null),
  recommendBudgetLimit: jest.fn().mockReturnValue(null),
  flagUnusualExpense: jest.fn().mockReturnValue([
    {
      user_id: 'user-sweep',
      type: 'unusual_expense',
      priority: 5,
      title: 'Unusual Shopping expense',
      description: 'much higher than typical',
      is_dismissed: false,
      metadata: { category_id: 'cat-1', transaction_id: 'tx-777' },
    },
  ]),
  generatePositiveReinforcement: jest.fn().mockReturnValue(null),
  executeRulesForCategory: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/ai/patternDetection', () => ({
  detectSpendingAnomalies: jest.fn().mockReturnValue([]),
  detectNewHighSpendCategories: jest.fn().mockReturnValue([]),
}));

const WATERMARK = '2026-08-20T10:00:00.000Z';

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`.
 *
 * The hand-rolled admin chain was ONE object for every table, so it had to keep
 * a side-channel of the sweep's filters - and a comment recorded that when
 * `delete()` shared the main chain, deleting `is_dismissed` from the SWEEP left
 * the assertion green (mutation testing caught it). The factory hands out a
 * FRESH chain per from(), so "the insights chain that called delete()" carries
 * the sweep's filters and nothing else - by construction, not by convention.
 *
 * `insights` answers the watermark row for every call: the watermark read is the
 * one that needs it, and the upsert and the sweep only need no error.
 */
const TX_ROWS = Array.from({ length: 12 }, (_, i) => ({
  id: `tx-${i}`,
  user_id: 'user-sweep',
  category_id: 'cat-1',
  amount: 85,
  type: 'expense',
  date: '2026-08-10',
  currency: 'EUR',
}));

/**
 * `generateInsights` returns EARLY when there are no transactions, so a client
 * that answers `[]` never reaches the write sequence this file is about.
 * Feeding it real-shaped rows is what makes the assertions reachable.
 */
function wire(watermark: string | null): SupabaseMock {
  const admin = createSupabaseMock({
    tables: { insights: { data: watermark ? { updated_at: watermark } : null, error: null } },
  });
  const user = createSupabaseMock({
    tables: {
      transactions: { data: TX_ROWS, error: null },
      categories: { data: [{ id: 'cat-1', name: 'Shopping', user_id: 'user-sweep' }], error: null },
    },
  });
  (createServiceRoleClient as jest.Mock).mockReturnValue(admin.client);
  (createClient as jest.Mock).mockResolvedValue(user.client);
  return admin;
}

/** Index of the insights chain that called delete() - the sweep. -1 if none. */
const sweepIndex = (admin: SupabaseMock) =>
  (admin.chains.insights ?? []).findIndex((c) => c.callsTo('delete').length > 0);

beforeEach(() => jest.clearAllMocks());

describe('the write sequence', () => {
  it('sweeps with is_dismissed = false and the DATABASE watermark', async () => {
    const admin = wire(WATERMARK);

    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-sweep', true);

    const sweep = sweepIndex(admin);
    expect(sweep).toBeGreaterThanOrEqual(0); // the sweep ran at all

    // THE PREDICATE THE FIX RESTS ON. Without it a dismissed row the rule no
    // longer produces is deleted, and the next run recreates it undismissed.
    expect(admin.callsTo('insights', 'eq', sweep)).toContainEqual(['is_dismissed', false]);

    // The cutoff is the value READ BACK from the database, never one the app
    // computed. If it were `new Date()`, a lambda clock running ahead of
    // Postgres would delete rows this very run had just written.
    expect(admin.callsTo('insights', 'lte', sweep)).toContainEqual(['updated_at', WATERMARK]);

    // And the upsert names the composite conflict target, or every row is an
    // insert and dismissals die exactly as before.
    expect(admin.allCallsTo('insights', 'upsert')[0]?.[1]).toMatchObject({
      onConflict: 'user_id,fingerprint',
    });
  });

  it('does not sweep at all when there is no previous watermark', async () => {
    // A brand-new user has no rows, so there is nothing that could be stale —
    // and no baseline to bound a delete with. Sweeping anyway would be a delete
    // with no lower bound, which is the shape of the bug being removed.
    const admin = wire(null);

    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-sweep', true);

    // PAIRED: the upsert ran, so the write sequence was reached - otherwise
    // "no delete" would also hold for a run that returned before writing.
    expect(admin.allCallsTo('insights', 'upsert').length).toBeGreaterThan(0);
    expect(admin.allCallsTo('insights', 'delete')).toEqual([]);
  });
});
