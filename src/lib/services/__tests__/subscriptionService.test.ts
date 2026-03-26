/**
 * Subscription Service Tests
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Tests for:
 * - Task 7.1: Subscription detection algorithm (pattern matching, frequency detection, edge cases)
 * - Task 7.2: flagUnusedSubscriptions logic (gap detection, threshold calculation)
 */

import {
  normalizeMerchant,
  classifyFrequency,
  amountsMatch,
  detectSubscriptions,
  flagUnusedSubscriptions,
  getSubscriptionsForUser,
  updateSubscriptionStatus,
  hasEnoughHistory,
  FREQUENCY_RANGES,
} from '../subscriptionService';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { createServiceRoleClient } from '@/lib/supabase/server';

const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;

// ============================================================================
// UNIT TESTS: Pure Functions
// ============================================================================

describe('normalizeMerchant', () => {
  it('lowercases and trims input', () => {
    expect(normalizeMerchant('  Netflix  ')).toBe('netflix');
  });

  it('strips common suffixes like Inc, LLC, Ltd', () => {
    expect(normalizeMerchant('Spotify Inc')).toBe('spotify');
    expect(normalizeMerchant('Adobe LLC')).toBe('adobe');
    expect(normalizeMerchant('Some Corp Ltd')).toBe('some');
  });

  it('strips domain suffixes like .com, .net', () => {
    expect(normalizeMerchant('NETFLIX.COM')).toBe('netflix');
    expect(normalizeMerchant('hulu.net')).toBe('hulu');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeMerchant('Apple   Music')).toBe('apple music');
  });

  it('handles empty string', () => {
    expect(normalizeMerchant('')).toBe('');
  });
});

describe('classifyFrequency', () => {
  it('classifies weekly intervals (5-9 days)', () => {
    expect(classifyFrequency([7, 7, 7, 8])).toBe('weekly');
  });

  it('classifies monthly intervals (25-35 days)', () => {
    expect(classifyFrequency([30, 31, 29, 30])).toBe('monthly');
  });

  it('classifies quarterly intervals (80-100 days)', () => {
    expect(classifyFrequency([90, 91, 89])).toBe('quarterly');
  });

  it('classifies annual intervals (340-395 days)', () => {
    expect(classifyFrequency([365, 366])).toBe('annual');
  });

  it('returns null for empty intervals', () => {
    expect(classifyFrequency([])).toBeNull();
  });

  it('returns null for inconsistent intervals', () => {
    // Truly inconsistent — no dominant pattern (each frequency type < 60%)
    expect(classifyFrequency([7, 15, 45, 12, 60])).toBeNull();
  });

  it('returns null for unrecognized intervals', () => {
    expect(classifyFrequency([15, 15, 15])).toBeNull();
  });

  it('tolerates minor variations in monthly intervals', () => {
    expect(classifyFrequency([28, 31, 30, 29])).toBe('monthly');
  });
});

describe('amountsMatch', () => {
  it('returns true for identical amounts', () => {
    expect(amountsMatch(9.99, 9.99)).toBe(true);
  });

  it('returns true for amounts within 10% tolerance', () => {
    expect(amountsMatch(10.0, 10.9)).toBe(true);
    expect(amountsMatch(10.0, 9.1)).toBe(true);
  });

  it('returns false for amounts outside 10% tolerance', () => {
    expect(amountsMatch(10.0, 12.0)).toBe(false);
  });

  it('handles zero amounts', () => {
    expect(amountsMatch(0, 0)).toBe(true);
  });
});

// ============================================================================
// INTEGRATION TESTS: Service Functions
// ============================================================================

describe('detectSubscriptions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Build chainable mock
    const fromResults: Record<string, unknown> = {};
    mockSupabase = {
      from: jest.fn((table: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.update = jest.fn().mockReturnValue(chain);
        chain.delete = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.in = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockReturnValue(chain);
        chain.lte = jest.fn().mockReturnValue(chain);
        chain.order = jest.fn().mockReturnValue(chain);
        chain.limit = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        // Store resolver for this table
        if (fromResults[table]) {
          const result = fromResults[table];
          chain.order = jest.fn().mockReturnValue({
            ...chain,
            then: (resolve: (value: unknown) => void) => resolve(result),
          });
        }

        return chain;
      }),
    };

    mockCreateServiceRoleClient.mockReturnValue(mockSupabase);
  });

  it('returns empty array when no transactions exist', async () => {
    // Setup mock to resolve transactions query with empty data
    const chain = createChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('detects monthly subscription pattern', async () => {
    const transactions = [
      { id: '1', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-01-15', notes: 'Netflix', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '2', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-02-15', notes: 'Netflix', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '3', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-03-15', notes: 'Netflix', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
    ];

    // First call: transactions query
    const txChain = createChainMock({ data: transactions, error: null });
    // Second call: check existing subscriptions
    const subChain = createChainMock(null);
    subChain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    subChain.insert = jest.fn().mockResolvedValue({ data: null, error: null });

    let callCount = 0;
    mockSupabase.from = jest.fn(() => {
      callCount++;
      return callCount === 1 ? txChain : subChain;
    });

    const result = await detectSubscriptions('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.merchant_pattern).toBe('netflix');
    expect(result[0]!.frequency).toBe('monthly');
    expect(result[0]!.estimated_amount).toBe(9.99);
  });

  it('ignores income transactions', async () => {
    const transactions = [
      { id: '1', user_id: 'user-1', category_id: 'cat-1', amount: 1000, type: 'income', date: '2026-01-01', notes: 'Salary', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '2', user_id: 'user-1', category_id: 'cat-1', amount: 1000, type: 'income', date: '2026-02-01', notes: 'Salary', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '3', user_id: 'user-1', category_id: 'cat-1', amount: 1000, type: 'income', date: '2026-03-01', notes: 'Salary', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
    ];

    const chain = createChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('requires minimum 3 transactions for detection', async () => {
    const transactions = [
      { id: '1', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-01-15', notes: 'Netflix', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '2', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-02-15', notes: 'Netflix', currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
    ];

    const chain = createChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('ignores transactions without notes', async () => {
    const transactions = [
      { id: '1', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-01-15', notes: null, currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '2', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-02-15', notes: null, currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
      { id: '3', user_id: 'user-1', category_id: 'cat-1', amount: 9.99, type: 'expense', date: '2026-03-15', notes: null, currency: 'EUR', exchange_rate: null, created_at: '', updated_at: '' },
    ];

    const chain = createChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });
});

describe('flagUnusedSubscriptions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn(),
    };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase);
  });

  it('returns 0 when no active subscriptions exist', async () => {
    const chain = createChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const count = await flagUnusedSubscriptions('user-1');
    expect(count).toBe(0);
  });

  it('flags subscription as unused when overdue by >1.5x interval', async () => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60); // 60 days > 30 * 1.5 = 45 threshold

    const activeSubs = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        merchant_pattern: 'netflix',
        estimated_amount: 9.99,
        frequency: 'monthly' as const,
        last_seen_at: sixtyDaysAgo.toISOString(),
        status: 'active' as const,
        created_at: '',
        updated_at: '',
      },
    ];

    // First call: select active subscriptions — .eq('user_id').eq('status') chain
    const selectChain = createChainMock(null);
    // First .eq() returns object with second .eq() that resolves
    selectChain.eq = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: activeSubs, error: null }),
    });

    // Second call: update
    const updateChain = createChainMock(null);
    updateChain.eq = jest.fn().mockResolvedValue({ data: null, error: null });

    let callCount = 0;
    mockSupabase.from = jest.fn(() => {
      callCount++;
      return callCount === 1 ? selectChain : updateChain;
    });

    const count = await flagUnusedSubscriptions('user-1');
    expect(count).toBe(1);
  });

  it('does not flag subscription that is still within expected window', async () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10); // 10 days < 30 * 1.5 = 45 threshold

    const activeSubs = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        merchant_pattern: 'netflix',
        estimated_amount: 9.99,
        frequency: 'monthly' as const,
        last_seen_at: tenDaysAgo.toISOString(),
        status: 'active' as const,
        created_at: '',
        updated_at: '',
      },
    ];

    const selectChain = createChainMock({ data: activeSubs, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(selectChain);

    const count = await flagUnusedSubscriptions('user-1');
    expect(count).toBe(0);
  });
});

describe('getSubscriptionsForUser', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
  });

  it('returns subscriptions filtered by active/unused/kept status', async () => {
    const subs = [
      { id: 'sub-1', status: 'active', merchant_pattern: 'netflix', estimated_amount: 9.99 },
      { id: 'sub-2', status: 'unused', merchant_pattern: 'hulu', estimated_amount: 7.99 },
    ];

    const chain = createDoubleOrderChainMock({ data: subs, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getSubscriptionsForUser(mockSupabase, 'user-1');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no subscriptions exist', async () => {
    const chain = createDoubleOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getSubscriptionsForUser(mockSupabase, 'user-1');
    expect(result).toEqual([]);
  });
});

describe('updateSubscriptionStatus', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
  });

  it('returns null when subscription not found', async () => {
    const chain = createChainMock(null);
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await updateSubscriptionStatus(mockSupabase, 'user-1', 'nonexistent', 'dismissed');
    expect(result).toBeNull();
  });

  it('updates subscription status to dismissed', async () => {
    const existing = { id: 'sub-1', user_id: 'user-1', status: 'active' };
    const updated = { ...existing, status: 'dismissed' };

    // First call: check existing
    const selectChain = createChainMock(null);
    selectChain.maybeSingle = jest.fn().mockResolvedValue({ data: existing, error: null });

    // Second call: update
    const updateChain = createChainMock(null);
    updateChain.single = jest.fn().mockResolvedValue({ data: updated, error: null });

    let callCount = 0;
    mockSupabase.from = jest.fn(() => {
      callCount++;
      return callCount === 1 ? selectChain : updateChain;
    });

    const result = await updateSubscriptionStatus(mockSupabase, 'user-1', 'sub-1', 'dismissed');
    expect(result).toEqual(updated);
  });
});

describe('hasEnoughHistory', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
    mockCreateServiceRoleClient.mockReturnValue(mockSupabase);
  });

  it('returns true when user has transactions older than 3 months', async () => {
    const chain = createChainMock({ data: [{ id: 'tx-1' }], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughHistory('user-1');
    expect(result).toBe(true);
  });

  it('returns false when user has no old transactions', async () => {
    const chain = createChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughHistory('user-1');
    expect(result).toBe(false);
  });
});

describe('FREQUENCY_RANGES', () => {
  it('covers all expected frequency types', () => {
    expect(FREQUENCY_RANGES).toHaveProperty('weekly');
    expect(FREQUENCY_RANGES).toHaveProperty('monthly');
    expect(FREQUENCY_RANGES).toHaveProperty('quarterly');
    expect(FREQUENCY_RANGES).toHaveProperty('annual');
  });

  it('has non-overlapping ranges', () => {
    const ranges = Object.values(FREQUENCY_RANGES);
    for (let i = 0; i < ranges.length - 1; i++) {
      expect(ranges[i]!.max).toBeLessThan(ranges[i + 1]!.min);
    }
  });
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a chainable mock that resolves with the given result at the end of the chain.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: resolveWith, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: resolveWith, error: null }),
  };

  // Make the chain itself thenable to resolve async iteration
  if (resolveWith !== null && resolveWith !== undefined) {
    // Override the last chainable to resolve
    const originalOrder = chain.order;
    chain.order = jest.fn((...args: unknown[]) => {
      const result = originalOrder(...args);
      // After second order call, resolve
      return {
        ...result,
        then: (resolve: (value: unknown) => void) => resolve(resolveWith),
      };
    });

    // Also make limit resolve
    chain.limit = jest.fn().mockResolvedValue(resolveWith);
  }

  return chain;
}

/**
 * Creates a chainable mock that supports double .order() calls (e.g., .order().order())
 * before resolving with the given result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDoubleOrderChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn(),
  };

  // Second .order() call returns a thenable that resolves
  const secondOrderResult = {
    then: (resolve: (value: unknown) => void) => resolve(resolveWith),
  };

  // First .order() returns an object with a second .order()
  chain.order = jest.fn().mockReturnValue({
    order: jest.fn().mockReturnValue(secondOrderResult),
  });

  return chain;
}
