/**
 * insightService — Pattern Detection Integration Smoke Tests
 * Story 12.1: Spending Anomaly & Trend Detection
 *
 * Verifies that detectSpendingAnomalies and detectNewHighSpendCategories
 * are actually invoked from generateInsights when transaction data exists.
 */

// ============================================================================
// MOCKS — pattern detection (must be before imports)
// ============================================================================

const mockDetectAnomalies = jest.fn().mockReturnValue([]);
const mockDetectNewHigh = jest.fn().mockReturnValue([]);

jest.mock('@/lib/ai/patternDetection', () => ({
  detectSpendingAnomalies: (...args: unknown[]) => mockDetectAnomalies(...args),
  detectNewHighSpendCategories: (...args: unknown[]) => mockDetectNewHigh(...args),
}));

jest.mock('@/lib/ai/insightRules', () => ({
  detectSpendingIncrease: jest.fn().mockReturnValue(null),
  recommendBudgetLimit: jest.fn().mockReturnValue(null),
  // hp-10: returns an ARRAY (one insight per outlier); the service spreads it.
  flagUnusualExpense: jest.fn().mockReturnValue([]),
  generatePositiveReinforcement: jest.fn().mockReturnValue(null),
  executeRulesForCategory: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

// ============================================================================
// SUPABASE MOCK — per-table routing
// ============================================================================

const fakeTx = {
  id: 'tx-1',
  user_id: 'user-abc',
  category_id: 'cat-1',
  amount: 100,
  type: 'expense',
  date: '2026-06-01',
  notes: null,
  currency: 'USD',
  exchange_rate: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const fakeCat = {
  id: 'cat-1',
  user_id: 'user-abc',
  name: 'Dining',
  color: '#000',
  type: 'expense',
  is_predefined: false,
  created_at: '2026-01-01T00:00:00Z',
};

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. Four hand-built chains
 * (transactions, categories, user_profiles, insights) dispatched by a table-name
 * `mockFrom` become one factory client per test. `insights` answers `[]`: the
 * factory reshapes that to null for the watermark's maybeSingle() (no previous
 * run, so no sweep) and returns [] for the awaited re-read - what the
 * hand-rolled thenable chain did.
 */
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

function wireClients() {
  const db = createSupabaseMock({
    tables: {
      transactions: { data: [fakeTx], error: null },
      categories: { data: [fakeCat], error: null },
      // the user's display currency (Story 12.x currency fix)
      user_profiles: { data: { preferences: { currency_format: 'USD' } }, error: null },
      insights: { data: [], error: null },
    },
  });
  (createClient as jest.Mock).mockResolvedValue(db.client);
  (createServiceRoleClient as jest.Mock).mockReturnValue(db.client);
  return db;
}

// ============================================================================
// TESTS
// ============================================================================

describe('generateInsights — pattern detection wiring (Story 12.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectAnomalies.mockReturnValue([]);
    mockDetectNewHigh.mockReturnValue([]);
    wireClients();
  });

  it('calls detectSpendingAnomalies when generateInsights runs with data', async () => {
    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-abc', true);
    expect(mockDetectAnomalies).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-abc' })
    );
  });

  it('calls detectNewHighSpendCategories when generateInsights runs with data', async () => {
    const { generateInsights } = await import('@/lib/services/insightService');
    await generateInsights('user-abc', true);
    expect(mockDetectNewHigh).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-abc' }));
  });
});
