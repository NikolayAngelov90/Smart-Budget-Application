/**
 * Subscription Service Tests
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Tests for:
 * - Task 7.1: Subscription detection algorithm (pattern matching, frequency detection, edge cases)
 * - Task 7.2: flagUnusedSubscriptions logic (gap detection, threshold calculation)
 */

import { createSupabaseMock } from '@/test-utils/supabaseChain';
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /*
   * MIGRATED. The beforeEach this replaces built a `fromResults` lookup that
   * NOTHING EVER WROTE TO - 0 assignments, 2 reads - so the branch reading it
   * could never run, and every test replaced `mockSupabase.from` regardless.
   * Dead mock machinery, removed rather than carried.
   *
   * detected_subscriptions answers `{ data: null }` for every call (a dry queue
   * repeats its last entry): no existing row, so detection takes the insert
   * path - exactly what the old `subChain` returned for every call after the
   * first.
   */
  function detectDb(transactions: unknown[]) {
    const db = createSupabaseMock({
      tables: {
        transactions: { data: transactions, error: null },
        detected_subscriptions: { data: null, error: null },
      },
    });
    mockCreateServiceRoleClient.mockReturnValue(db.client as never);
    return db;
  }

  it('returns empty array when no transactions exist', async () => {
    // Setup mock to resolve transactions query with empty data
    detectDb([]);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('detects monthly subscription pattern', async () => {
    const transactions = [
      {
        id: '1',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-01-15',
        notes: 'Netflix',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-02-15',
        notes: 'Netflix',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-03-15',
        notes: 'Netflix',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
    ];

    detectDb(transactions);

    const result = await detectSubscriptions('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.merchant_pattern).toBe('netflix');
    expect(result[0]!.frequency).toBe('monthly');
    expect(result[0]!.estimated_amount).toBe(9.99);
  });

  it('ignores income transactions', async () => {
    const transactions = [
      {
        id: '1',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 1000,
        type: 'income',
        date: '2026-01-01',
        notes: 'Salary',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 1000,
        type: 'income',
        date: '2026-02-01',
        notes: 'Salary',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 1000,
        type: 'income',
        date: '2026-03-01',
        notes: 'Salary',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
    ];

    detectDb(transactions);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('requires minimum 3 transactions for detection', async () => {
    const transactions = [
      {
        id: '1',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-01-15',
        notes: 'Netflix',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-02-15',
        notes: 'Netflix',
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
    ];

    detectDb(transactions);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });

  it('ignores transactions without notes', async () => {
    const transactions = [
      {
        id: '1',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-01-15',
        notes: null,
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-02-15',
        notes: null,
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        user_id: 'user-1',
        category_id: 'cat-1',
        amount: 9.99,
        type: 'expense',
        date: '2026-03-15',
        notes: null,
        currency: 'EUR',
        exchange_rate: null,
        created_at: '',
        updated_at: '',
      },
    ];

    detectDb(transactions);

    const result = await detectSubscriptions('user-1');
    expect(result).toEqual([]);
  });
});

describe('flagUnusedSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** detected_subscriptions: the active-subscription read, then any update(s). */
  function flagDb(results: Array<{ data: unknown; error: unknown }>) {
    const db = createSupabaseMock({ tables: { detected_subscriptions: results as never } });
    mockCreateServiceRoleClient.mockReturnValue(db.client as never);
    return db;
  }

  it('returns 0 when no active subscriptions exist', async () => {
    flagDb([{ data: [], error: null }]);

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

    // The active-subscription read, then the update.
    flagDb([
      { data: activeSubs, error: null },
      { data: null, error: null },
    ]);

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

    flagDb([{ data: activeSubs, error: null }]);

    const count = await flagUnusedSubscriptions('user-1');
    expect(count).toBe(0);
  });
});

describe('getSubscriptionsForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /*
   * The hand-rolled createDoubleOrderChainMock existed only because this query
   * ends `.order().order()`; the factory is thenable after any number of calls.
   */
  const subsClient = (data: unknown[]) =>
    createSupabaseMock({ tables: { detected_subscriptions: { data, error: null } } }).client;

  it('returns subscriptions filtered by active/unused/kept status', async () => {
    const subs = [
      { id: 'sub-1', status: 'active', merchant_pattern: 'netflix', estimated_amount: 9.99 },
      { id: 'sub-2', status: 'unused', merchant_pattern: 'hulu', estimated_amount: 7.99 },
    ];

    const result = await getSubscriptionsForUser(subsClient(subs), 'user-1');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no subscriptions exist', async () => {
    const result = await getSubscriptionsForUser(subsClient([]), 'user-1');
    expect(result).toEqual([]);
  });
});

describe('updateSubscriptionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** detected_subscriptions: the existence check, then the update...single. */
  const statusClient = (results: Array<{ data: unknown; error: unknown }>) =>
    createSupabaseMock({ tables: { detected_subscriptions: results as never } }).client;

  it('returns null when subscription not found', async () => {
    const result = await updateSubscriptionStatus(
      statusClient([{ data: null, error: null }]),
      'user-1',
      'nonexistent',
      'dismissed'
    );
    expect(result).toBeNull();
  });

  it('updates subscription status to dismissed', async () => {
    const existing = { id: 'sub-1', user_id: 'user-1', status: 'active' };
    const updated = { ...existing, status: 'dismissed' };

    const client = statusClient([
      { data: existing, error: null }, // the existence check
      { data: updated, error: null }, // the update
    ]);

    const result = await updateSubscriptionStatus(client, 'user-1', 'sub-1', 'dismissed');
    expect(result).toEqual(updated);
  });
});

describe('hasEnoughHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function historyDb(data: unknown[]) {
    const db = createSupabaseMock({ tables: { transactions: { data, error: null } } });
    mockCreateServiceRoleClient.mockReturnValue(db.client as never);
    return db;
  }

  it('returns true when user has transactions older than 3 months', async () => {
    historyDb([{ id: 'tx-1' }]);

    const result = await hasEnoughHistory('user-1');
    expect(result).toBe(true);
  });

  it('returns false when user has no old transactions', async () => {
    historyDb([]);

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
