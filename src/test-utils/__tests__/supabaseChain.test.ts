/**
 * @jest-environment node
 */

/**
 * The shared chain mock has to be trustworthy before anything depends on it,
 * so these pin the three failures it exists to prevent — each one an actual
 * incident from Epic 16, named in the test title.
 */

import {
  createQueryChain,
  createSupabaseMock,
  expectUserScoped,
  expectChainUserScoped,
} from '@/test-utils/supabaseChain';

describe('createQueryChain', () => {
  it('resolves to the configured result when awaited', async () => {
    const chain = createQueryChain({ data: [{ id: 1 }], error: null });
    await expect(chain).resolves.toEqual({ data: [{ id: 1 }], error: null });
  });

  it('survives a method the test never anticipated', async () => {
    // THE bug this replaces. A hand-rolled stub defining only select/eq breaks
    // the moment a route adds `.upsert()` — it returns undefined, the call
    // throws into a catch, and the route degrades silently while the test
    // reports a behaviour failure.
    const chain = createQueryChain({ data: null, error: null });
    const result = await chain
      .upsert({ a: 1 }, { onConflict: 'a' })
      .select('x')
      .not('household_id', 'is', null)
      .in('id', ['a'])
      .gte('date', '2026-01-01')
      .order('id')
      .range(0, 10)
      .maybeSingle();

    expect(result).toEqual({ data: null, error: null });
  });

  it('records every call with its arguments', () => {
    const chain = createQueryChain();
    chain.select('*').eq('user_id', 'u-1').eq('type', 'expense');

    expect(chain.callsTo('eq')).toEqual([
      ['user_id', 'u-1'],
      ['type', 'expense'],
    ]);
    expect(chain.calledWith('select', '*')).toBe(true);
    expect(chain.calledWith('eq', 'user_id', 'nope')).toBe(false);
  });

  it('works as the terminal of any chain shape', async () => {
    const result = { data: { id: 'x' }, error: null };
    await expect(createQueryChain(result).select().eq().single()).resolves.toEqual(result);
    await expect(createQueryChain(result).select().eq()).resolves.toEqual(result);
    await expect(createQueryChain(result).select()).resolves.toEqual(result);
  });

  it('does not masquerade as a React element or a matcher', () => {
    // A Proxy answering EVERY property breaks jest/React internals unless the
    // probe properties are passed through.
    const chain = createQueryChain();
    expect(chain.$$typeof).toBeUndefined();
    expect(chain.nodeType).toBeUndefined();
    expect(chain.asymmetricMatch).toBeUndefined();
  });
});

describe('createSupabaseMock', () => {
  it('returns per-table results', async () => {
    const db = createSupabaseMock({
      tables: {
        transactions: { data: [{ amount: 10 }], error: null },
        categories: { data: [{ id: 'c1' }], error: null },
      },
    });

    await expect(db.client.from('transactions').select()).resolves.toEqual({
      data: [{ amount: 10 }],
      error: null,
    });
    await expect(db.client.from('categories').select()).resolves.toEqual({
      data: [{ id: 'c1' }],
      error: null,
    });
  });

  it('serves an array as a queue, in from() order', async () => {
    // How a paginated loop behaves: one from() per page.
    const db = createSupabaseMock({
      tables: {
        streaks: [
          { data: [{ user_id: 'a' }], error: null },
          { data: [], error: null },
        ],
      },
    });

    await expect(db.client.from('streaks').select().range(0, 1)).resolves.toEqual({
      data: [{ user_id: 'a' }],
      error: null,
    });
    await expect(db.client.from('streaks').select().range(1, 2)).resolves.toEqual({
      data: [],
      error: null,
    });
  });

  it('gives an unconfigured table an empty result rather than throwing', async () => {
    // A test should configure only what it asserts on. A route querying a table
    // the test forgot must not 500 — that is the second failure mode from
    // Epic 16 (notification_deliveries).
    const db = createSupabaseMock({ tables: {} });
    await expect(db.client.from('anything_at_all').select()).resolves.toEqual({
      data: [],
      error: null,
    });
  });

  it('exposes chains per table for filter assertions', async () => {
    const db = createSupabaseMock({ tables: { transactions: { data: [], error: null } } });

    await db.client
      .from('transactions')
      .select('*')
      .eq('user_id', 'user-1')
      .gte('date', '2026-07-01');

    expect(db.callsTo('transactions', 'eq')).toContainEqual(['user_id', 'user-1']);
    expect(db.callsTo('transactions', 'gte')).toContainEqual(['date', '2026-07-01']);
    expectUserScoped(db, 'transactions', 'user-1');
  });

  it('distinguishes repeated queries against the same table', async () => {
    const db = createSupabaseMock({
      tables: {
        transactions: [
          { data: [{ n: 1 }], error: null },
          { data: [{ n: 2 }], error: null },
        ],
      },
    });

    await db.client.from('transactions').select().gte('date', 'current');
    await db.client.from('transactions').select().gte('date', 'previous');

    expect(db.callsTo('transactions', 'gte', 0)).toEqual([['date', 'current']]);
    expect(db.callsTo('transactions', 'gte', 1)).toEqual([['date', 'previous']]);
  });

  it('names the tables actually queried when a chain is missing', async () => {
    const db = createSupabaseMock();
    await db.client.from('categories').select();

    // A useful message beats "cannot read properties of undefined".
    expect(() => db.chainFor('transactions')).toThrow(/categories/);
  });

  it('provides auth, authenticated by default', async () => {
    const db = createSupabaseMock();
    await expect(db.client.auth.getUser()).resolves.toEqual({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('supports an unauthenticated client', async () => {
    const db = createSupabaseMock({ user: null });
    const { data, error } = await db.client.auth.getUser();
    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
  });

  it('provides rpc so a route calling one does not explode', async () => {
    // The third Epic 16 failure: unlockAchievements upserts then selects via
    // rpc-adjacent paths, and a missing method threw into the route's catch.
    const db = createSupabaseMock();
    await expect(db.client.rpc('anything', {})).resolves.toEqual({ data: null, error: null });
  });
});

describe('expectChainUserScoped', () => {
  it('fails when the user filter is missing — the leak it guards', () => {
    const chain = createQueryChain();
    chain.select('*').eq('type', 'expense');

    expect(() => expectChainUserScoped(chain, 'user-1')).toThrow();
  });
});
