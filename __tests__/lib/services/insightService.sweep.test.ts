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

/** Records every call so the assertions can read the arguments back. */
function makeAdminChain() {
  const calls = {
    upsert: [] as unknown[][],
    delete: 0,
    // SWEEP-SCOPED. An earlier version recorded every `.eq()` on one array and
    // was VACUOUS: the final re-read also calls `.eq('is_dismissed', false)`, so
    // deleting that clause from the SWEEP left the assertion green. Mutation
    // testing caught it. `delete()` now returns its own chain, so these arrays
    // contain the sweep's filters and nothing else.
    sweepEq: [] as unknown[][],
    sweepLte: [] as unknown[][],
    sweepNot: [] as unknown[][],
  };

  const sweepChain: Record<string, unknown> = {
    eq: jest.fn((...args: unknown[]) => {
      calls.sweepEq.push(args);
      return sweepChain;
    }),
    lte: jest.fn((...args: unknown[]) => {
      calls.sweepLte.push(args);
      return sweepChain;
    }),
    not: jest.fn((...args: unknown[]) => {
      calls.sweepNot.push(args);
      return Promise.resolve({ error: null });
    }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };

  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue({ data: { updated_at: WATERMARK }, error: null }),
    upsert: jest.fn((...args: unknown[]) => {
      calls.upsert.push(args);
      return Promise.resolve({ error: null });
    }),
    delete: jest.fn(() => {
      calls.delete += 1;
      return sweepChain;
    }),
    // markGenerated (hp-8) writes the run marker through the same client.
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    // Chainable AND thenable: the four calls terminate at different methods, so
    // guessing a single terminator would break one of them.
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };

  return { chain, calls };
}

/**
 * A read chain that answers ANY method by returning itself and resolves to empty
 * when awaited. The service makes several different reads through the user
 * client and they terminate at different methods; enumerating them would mean
 * guessing, and guessing wrong fails as "x.eq is not a function" — which is the
 * good failure mode, but not one worth spending iterations on here. The
 * assertions in this file are all about the ADMIN chain.
 */
function makeReadChain(rows: unknown[]): Record<string, unknown> {
  const chain = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (prop === 'maybeSingle') {
          return () => Promise.resolve({ data: rows[0] ?? null, error: null });
        }
        return () => chain;
      },
    }
  ) as Record<string, unknown>;
  return chain;
}

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
 * `generateInsights` returns EARLY when there are no transactions, so a chain
 * that resolves to `[]` never reaches the write sequence this file is about.
 * Feeding it real-shaped rows is what makes the assertions reachable.
 */
const readFor = (table: string) =>
  makeReadChain(
    table === 'transactions'
      ? TX_ROWS
      : table === 'categories'
        ? [{ id: 'cat-1', name: 'Shopping', user_id: 'user-sweep' }]
        : []
  );

beforeEach(() => jest.clearAllMocks());

describe('the write sequence', () => {
  it('sweeps with is_dismissed = false and the DATABASE watermark', async () => {
    const { chain, calls } = makeAdminChain();
    (createServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });
    (createClient as jest.Mock).mockResolvedValue({ from: jest.fn((t: string) => readFor(t)) });

    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-sweep', true);

    // THE PREDICATE THE FIX RESTS ON. Without it a dismissed row the rule no
    // longer produces is deleted, and the next run recreates it undismissed.
    expect(calls.sweepEq).toContainEqual(['is_dismissed', false]);

    // The cutoff is the value READ BACK from the database, never one the app
    // computed. If it were `new Date()`, a lambda clock running ahead of
    // Postgres would delete rows this very run had just written.
    expect(calls.sweepLte).toContainEqual(['updated_at', WATERMARK]);

    // And the upsert names the composite conflict target, or every row is an
    // insert and dismissals die exactly as before.
    expect(calls.upsert[0]?.[1]).toMatchObject({ onConflict: 'user_id,fingerprint' });
  });

  it('does not sweep at all when there is no previous watermark', async () => {
    // A brand-new user has no rows, so there is nothing that could be stale —
    // and no baseline to bound a delete with. Sweeping anyway would be a delete
    // with no lower bound, which is the shape of the bug being removed.
    const { chain, calls } = makeAdminChain();
    (chain.maybeSingle as jest.Mock).mockResolvedValue({ data: null, error: null });
    (createServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) });
    (createClient as jest.Mock).mockResolvedValue({ from: jest.fn((t: string) => readFor(t)) });

    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-sweep', true);

    expect(calls.delete).toBe(0);
  });
});
