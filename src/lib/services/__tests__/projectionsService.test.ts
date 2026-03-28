/**
 * Projections Service Tests
 * Story 11.4: Annualized Spending Projections
 *
 * Task 8.1: Unit tests for projectionsService.ts
 * - hasEnoughDataForProjections: pre-current-month threshold
 * - getAnnualizedProjections: aggregation, monthly avg, annual projection,
 *   trend, is_recurring, sort order
 */

import {
  hasEnoughDataForProjections,
  getAnnualizedProjections,
} from '../projectionsService';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a chainable Supabase mock that resolves after .order() (terminal).
 * Used for transaction queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createOrderChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockResolvedValue(resolveWith);
  return chain;
}

/**
 * Creates a chainable Supabase mock that resolves after .limit() (terminal).
 * Used for hasEnoughDataForProjections .lt().limit() chain.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLtLimitChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.lt = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockResolvedValue(resolveWith);
  return chain;
}

/**
 * Creates a chainable Supabase mock that resolves after .in() (terminal).
 * Used for detected_subscriptions query.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createInTerminalChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockResolvedValue(resolveWith);
  return chain;
}

// ============================================================================
// hasEnoughDataForProjections
// ============================================================================

describe('hasEnoughDataForProjections', () => {
  it('returns true when expense transaction exists before current month', async () => {
    const chain = createLtLimitChainMock({ data: [{ date: '2026-01-15' }], error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof hasEnoughDataForProjections>[0];

    const result = await hasEnoughDataForProjections(supabase, 'user-1');

    expect(result).toBe(true);
    expect(chain.lt).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns false when no expense transactions before current month', async () => {
    const chain = createLtLimitChainMock({ data: [], error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof hasEnoughDataForProjections>[0];

    const result = await hasEnoughDataForProjections(supabase, 'user-1');

    expect(result).toBe(false);
  });

  it('returns false with only current-month expenses (lt filter excludes them)', async () => {
    // The .lt('date', currentMonthStart) filter returns empty — current-month transactions
    // are excluded by the service query, so the result data is empty
    const chain = createLtLimitChainMock({ data: [], error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof hasEnoughDataForProjections>[0];

    const result = await hasEnoughDataForProjections(supabase, 'user-1');

    expect(result).toBe(false);
    // Verify lt was called to enforce the "before current month" constraint
    expect(chain.lt).toHaveBeenCalledWith('date', expect.stringMatching(/^\d{4}-\d{2}-01$/));
  });

  it('throws on DB error (never silently returns false)', async () => {
    const dbError = new Error('Connection refused');
    const chain = createLtLimitChainMock({ data: null, error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof hasEnoughDataForProjections>[0];

    await expect(hasEnoughDataForProjections(supabase, 'user-1')).rejects.toThrow('Connection refused');
  });
});

// ============================================================================
// getAnnualizedProjections
// ============================================================================

describe('getAnnualizedProjections', () => {
  function buildSupabaseMock(
    currentTxns: object[],
    prevTxns: object[],
    subscriptions: object[]
  ) {
    const currChain = createOrderChainMock({ data: currentTxns, error: null });
    const prevChain = createOrderChainMock({ data: prevTxns, error: null });
    const subsChain = createInTerminalChainMock({ data: subscriptions, error: null });

    let callCount = 0;
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'detected_subscriptions') return subsChain;
        // First two calls are current and prev period transaction queries
        callCount++;
        return callCount === 1 ? currChain : prevChain;
      }),
    };
    return supabase as unknown as Parameters<typeof getAnnualizedProjections>[0];
  }

  it('aggregates spending across multiple categories', async () => {
    const currentTxns = [
      { amount: 50, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff0000' } },
      { amount: 30, category_id: 'cat-1', date: '2026-01-20', categories: { id: 'cat-1', name: 'Food', color: '#ff0000' } },
      { amount: 100, category_id: 'cat-2', date: '2026-01-15', categories: { id: 'cat-2', name: 'Transport', color: '#00ff00' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    expect(result.hasEnoughData).toBe(true);
    expect(result.projections).toHaveLength(2);

    const food = result.projections.find((p) => p.category_name === 'Food');
    const transport = result.projections.find((p) => p.category_name === 'Transport');

    expect(food).toBeDefined();
    expect(food?.transaction_count).toBe(2);
    expect(transport).toBeDefined();
    expect(transport?.transaction_count).toBe(1);
  });

  it('computes monthly avg as total / months_analyzed', async () => {
    // Two distinct months of data
    const currentTxns = [
      { amount: 120, category_id: 'cat-1', date: '2025-12-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
      { amount: 60, category_id: 'cat-1', date: '2026-01-15', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    expect(result.months_analyzed).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const food = result.projections[0]!;
    // total = 180, months = 2, monthly_avg = 90
    expect(food.monthly_avg).toBe(90);
    expect(food.annual_projection).toBe(1080);
  });

  it('rounds monthly avg and annual projection to 2dp', async () => {
    // 100 / 3 months = 33.333... → rounds to 33.33
    const currentTxns = [
      { amount: 33, category_id: 'cat-1', date: '2025-11-01', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
      { amount: 33, category_id: 'cat-1', date: '2025-12-01', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
      { amount: 34, category_id: 'cat-1', date: '2026-01-01', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const food = result.projections[0]!;
    expect(food.monthly_avg).toBe(Math.round((100 / 3) * 100) / 100);
    expect(food.annual_projection).toBe(Math.round(food.monthly_avg * 12 * 100) / 100);
  });

  it("sets trend to 'new' when no prior period data for category", async () => {
    const currentTxns = [
      { amount: 100, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend).toBe('new');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend_percentage).toBeNull();
  });

  it("sets trend to 'up' when current monthly avg > prior by ≥5%", async () => {
    const currentTxns = [
      { amount: 110, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const prevTxns = [
      { amount: 100, category_id: 'cat-1', date: '2025-10-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, prevTxns, []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend).toBe('up');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend_percentage).toBe(10);
  });

  it("sets trend to 'down' when current monthly avg < prior by ≥5%", async () => {
    const currentTxns = [
      { amount: 90, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const prevTxns = [
      { amount: 100, category_id: 'cat-1', date: '2025-10-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, prevTxns, []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend).toBe('down');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend_percentage).toBe(-10);
  });

  it("sets trend to 'stable' when change < 5%", async () => {
    const currentTxns = [
      { amount: 102, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const prevTxns = [
      { amount: 100, category_id: 'cat-1', date: '2025-10-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, prevTxns, []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.trend).toBe('stable');
  });

  it('sets is_recurring true when category matches detected subscription', async () => {
    const currentTxns = [
      { amount: 15, category_id: 'cat-streaming', date: '2026-01-01', categories: { id: 'cat-streaming', name: 'Streaming', color: '#blue' } },
      { amount: 50, category_id: 'cat-food', date: '2026-01-05', categories: { id: 'cat-food', name: 'Food', color: '#green' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], [
      { category_id: 'cat-streaming' },
    ]);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    const streaming = result.projections.find((p) => p.category_id === 'cat-streaming');
    const food = result.projections.find((p) => p.category_id === 'cat-food');

    expect(streaming?.is_recurring).toBe(true);
    expect(food?.is_recurring).toBe(false);
  });

  it('sorts projections by annual_projection descending', async () => {
    const currentTxns = [
      { amount: 10, category_id: 'cat-small', date: '2026-01-01', categories: { id: 'cat-small', name: 'Small', color: '#aaa' } },
      { amount: 500, category_id: 'cat-big', date: '2026-01-02', categories: { id: 'cat-big', name: 'Big', color: '#bbb' } },
      { amount: 100, category_id: 'cat-mid', date: '2026-01-03', categories: { id: 'cat-mid', name: 'Mid', color: '#ccc' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[0]!.category_id).toBe('cat-big');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[1]!.category_id).toBe('cat-mid');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.projections[2]!.category_id).toBe('cat-small');
  });

  it('throws on DB error for current period query', async () => {
    const dbError = new Error('Query failed');
    const chain = createOrderChainMock({ data: null, error: dbError });
    const subsChain = createInTerminalChainMock({ data: [], error: null });
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'detected_subscriptions') return subsChain;
        return chain;
      }),
    } as unknown as Parameters<typeof getAnnualizedProjections>[0];

    await expect(getAnnualizedProjections(supabase, 'user-1')).rejects.toThrow('Query failed');
  });

  it('throws on DB error for detected_subscriptions query', async () => {
    const subsError = new Error('Subscriptions query failed');
    const currChain = createOrderChainMock({ data: [], error: null });
    const subsChain = createInTerminalChainMock({ data: null, error: subsError });
    let callCount = 0;
    const supabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'detected_subscriptions') return subsChain;
        callCount++;
        return callCount === 1 ? currChain : createOrderChainMock({ data: [], error: null });
      }),
    } as unknown as Parameters<typeof getAnnualizedProjections>[0];

    await expect(getAnnualizedProjections(supabase, 'user-1')).rejects.toThrow('Subscriptions query failed');
  });

  it('returns hasEnoughData true with correct months_analyzed', async () => {
    const currentTxns = [
      { amount: 50, category_id: 'cat-1', date: '2025-12-05', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
      { amount: 60, category_id: 'cat-1', date: '2026-01-10', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
      { amount: 70, category_id: 'cat-1', date: '2026-02-15', categories: { id: 'cat-1', name: 'Food', color: '#ff' } },
    ];
    const supabase = buildSupabaseMock(currentTxns, [], []);
    const result = await getAnnualizedProjections(supabase, 'user-1');

    expect(result.hasEnoughData).toBe(true);
    expect(result.months_analyzed).toBe(3);
  });
});
