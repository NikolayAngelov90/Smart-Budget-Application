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
  flagUnusualExpense: jest.fn().mockReturnValue(null),
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
  id: 'tx-1', user_id: 'user-abc', category_id: 'cat-1',
  amount: 100, type: 'expense', date: '2026-06-01', notes: null,
  currency: 'USD', exchange_rate: null, created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
};

const fakeCat = {
  id: 'cat-1', user_id: 'user-abc', name: 'Dining',
  color: '#000', type: 'expense', is_predefined: false, created_at: '2026-01-01T00:00:00Z',
};

const txChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [fakeTx], error: null }),
};

const catChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockResolvedValue({ data: [fakeCat], error: null }),
};

// user_profiles fetch for the user's display currency (Story 12.x currency fix)
const profileChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({
    data: { preferences: { currency_format: 'USD' } },
    error: null,
  }),
};

const deleteChain = {
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockResolvedValue({ error: null }),
};

const insertChain = {
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue({ data: [], error: null }),
};

const mockFrom = jest.fn().mockImplementation((table: string) => {
  if (table === 'transactions') return txChain;
  if (table === 'categories') return catChain;
  if (table === 'user_profiles') return profileChain;
  // For delete (service role client)
  return { ...deleteChain, ...insertChain };
});

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: (...args: unknown[]) => mockFrom(...args) }),
  createServiceRoleClient: jest.fn().mockReturnValue({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('generateInsights — pattern detection wiring (Story 12.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectAnomalies.mockReturnValue([]);
    mockDetectNewHigh.mockReturnValue([]);
    txChain.order.mockResolvedValue({ data: [fakeTx], error: null });
    catChain.eq.mockResolvedValue({ data: [fakeCat], error: null });
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
    expect(mockDetectNewHigh).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-abc' })
    );
  });
});
