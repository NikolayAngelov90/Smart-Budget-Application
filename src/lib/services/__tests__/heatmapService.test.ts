/**
 * Heatmap Service Tests
 * Story 11.3: Spending Heatmap
 *
 * Task 9.1: Unit tests for heatmapService.ts
 * - getDailySpending: aggregation, empty month, rounding, multiple tx same day
 * - hasEnoughDataForHeatmap: 7+ distinct dates threshold
 * - getIntensityLevel: quartile calculations
 */

import {
  getDailySpending,
  hasEnoughDataForHeatmap,
  getIntensityLevel,
} from '../heatmapService';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a chainable Supabase mock that resolves with the given result
 * after the terminal .order() call (used by getDailySpending).
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
 * Creates a chainable Supabase mock that resolves with the given result
 * after the second .eq() call (used by hasEnoughDataForHeatmap).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createEqTerminalChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  // First .eq('user_id') returns chain; second .eq('type') is the terminal call
  chain.eq = jest.fn()
    .mockReturnValueOnce(chain)
    .mockResolvedValueOnce(resolveWith);
  return chain;
}

// ============================================================================
// PURE FUNCTION: getIntensityLevel
// ============================================================================

describe('getIntensityLevel', () => {
  it('returns 0 for zero amount', () => {
    expect(getIntensityLevel(0, 100)).toBe(0);
  });

  it('returns 0 when maxAmount is 0', () => {
    expect(getIntensityLevel(0, 0)).toBe(0);
  });

  it('returns 0 when amount is 0 even with non-zero max', () => {
    expect(getIntensityLevel(0, 50)).toBe(0);
  });

  it('returns 1 for ratio <= 0.25 (bottom quartile)', () => {
    expect(getIntensityLevel(25, 100)).toBe(1);
    expect(getIntensityLevel(10, 100)).toBe(1);
    expect(getIntensityLevel(1, 100)).toBe(1);
  });

  it('returns 2 for ratio 0.26-0.50 (second quartile)', () => {
    expect(getIntensityLevel(26, 100)).toBe(2);
    expect(getIntensityLevel(50, 100)).toBe(2);
  });

  it('returns 3 for ratio 0.51-0.75 (third quartile)', () => {
    expect(getIntensityLevel(51, 100)).toBe(3);
    expect(getIntensityLevel(75, 100)).toBe(3);
  });

  it('returns 4 for ratio > 0.75 (top quartile)', () => {
    expect(getIntensityLevel(76, 100)).toBe(4);
    expect(getIntensityLevel(100, 100)).toBe(4);
  });

  it('returns 4 when amount equals maxAmount (full intensity)', () => {
    expect(getIntensityLevel(50, 50)).toBe(4);
  });

  it('handles decimal amounts', () => {
    expect(getIntensityLevel(12.5, 50)).toBe(1);  // 0.25 exactly → 1
    expect(getIntensityLevel(12.6, 50)).toBe(2);  // >0.25 → 2
  });
});

// ============================================================================
// SERVICE: getDailySpending
// ============================================================================

describe('getDailySpending', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
  });

  it('returns empty array when no transactions exist in month', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getDailySpending(mockSupabase, 'user-1', 2026, 3);
    expect(result).toEqual([]);
  });

  it('aggregates multiple transactions on the same day', async () => {
    const transactions = [
      { date: '2026-03-15', amount: 20.0 },
      { date: '2026-03-15', amount: 30.0 },
      { date: '2026-03-15', amount: 10.5 },
    ];
    const chain = createOrderChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getDailySpending(mockSupabase, 'user-1', 2026, 3);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ date: '2026-03-15', total: 60.5, count: 3 });
  });

  it('returns entries for multiple days sorted by date ascending', async () => {
    const transactions = [
      { date: '2026-03-20', amount: 50.0 },
      { date: '2026-03-05', amount: 25.0 },
      { date: '2026-03-10', amount: 15.0 },
    ];
    const chain = createOrderChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getDailySpending(mockSupabase, 'user-1', 2026, 3);

    expect(result).toHaveLength(3);
    expect(result[0]!.date).toBe('2026-03-05');
    expect(result[1]!.date).toBe('2026-03-10');
    expect(result[2]!.date).toBe('2026-03-20');
  });

  it('rounds totals to 2 decimal places to avoid floating-point drift', async () => {
    const transactions = [
      { date: '2026-03-01', amount: 0.1 },
      { date: '2026-03-01', amount: 0.2 },
    ];
    const chain = createOrderChainMock({ data: transactions, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await getDailySpending(mockSupabase, 'user-1', 2026, 3);

    expect(result[0]!.total).toBe(0.3);
    expect(result[0]!.count).toBe(2);
  });

  it('throws error when supabase query fails', async () => {
    const chain = createOrderChainMock({ data: null, error: { message: 'DB error' } });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await expect(getDailySpending(mockSupabase, 'user-1', 2026, 3)).rejects.toEqual(
      expect.objectContaining({ message: 'DB error' })
    );
  });

  it('queries with correct date range for the given month', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await getDailySpending(mockSupabase, 'user-1', 2026, 3);

    expect(chain.gte).toHaveBeenCalledWith('date', '2026-03-01');
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-03-31');
  });

  it('queries with correct date range for February (non-leap year)', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await getDailySpending(mockSupabase, 'user-1', 2025, 2);

    expect(chain.gte).toHaveBeenCalledWith('date', '2025-02-01');
    expect(chain.lte).toHaveBeenCalledWith('date', '2025-02-28');
  });

  it('queries with correct date range for February (leap year)', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await getDailySpending(mockSupabase, 'user-1', 2024, 2);

    expect(chain.gte).toHaveBeenCalledWith('date', '2024-02-01');
    expect(chain.lte).toHaveBeenCalledWith('date', '2024-02-29');
  });

  it('filters by user_id and type expense', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await getDailySpending(mockSupabase, 'user-abc', 2026, 3);

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
    expect(chain.eq).toHaveBeenCalledWith('type', 'expense');
  });
});

// ============================================================================
// SERVICE: hasEnoughDataForHeatmap
// ============================================================================

describe('hasEnoughDataForHeatmap', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
  });

  it('returns true when user has 7+ distinct transaction dates', async () => {
    const data = [
      { date: '2026-03-01' },
      { date: '2026-03-02' },
      { date: '2026-03-03' },
      { date: '2026-03-04' },
      { date: '2026-03-05' },
      { date: '2026-03-06' },
      { date: '2026-03-07' },
    ];
    const chain = createEqTerminalChainMock({ data, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(true);
  });

  it('returns false when user has fewer than 7 distinct dates', async () => {
    const data = [
      { date: '2026-03-01' },
      { date: '2026-03-02' },
      { date: '2026-03-03' },
    ];
    const chain = createEqTerminalChainMock({ data, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(false);
  });

  it('returns false when no transactions exist', async () => {
    const chain = createEqTerminalChainMock({ data: [], error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(false);
  });

  it('deduplicates dates — multiple transactions on the same day count as one distinct date', async () => {
    // 6 entries but only 6 distinct dates — returns false (need 7)
    const data = [
      { date: '2026-03-01' },
      { date: '2026-03-01' }, // duplicate
      { date: '2026-03-02' },
      { date: '2026-03-03' },
      { date: '2026-03-04' },
      { date: '2026-03-05' },
      { date: '2026-03-06' },
    ];
    const chain = createEqTerminalChainMock({ data, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(false); // only 6 distinct dates
  });

  it('returns true with exactly 7 distinct dates (at threshold)', async () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    }));
    // Add duplicates — still 10 distinct dates
    data.push({ date: '2026-03-01' }, { date: '2026-03-02' });
    const chain = createEqTerminalChainMock({ data, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(true);
  });

  it('returns false when data is null', async () => {
    const chain = createEqTerminalChainMock({ data: null, error: null });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    const result = await hasEnoughDataForHeatmap(mockSupabase, 'user-1');
    expect(result).toBe(false);
  });

  it('throws error when supabase query fails', async () => {
    const chain = createEqTerminalChainMock({ data: null, error: { message: 'DB error' } });
    mockSupabase.from = jest.fn().mockReturnValue(chain);

    await expect(hasEnoughDataForHeatmap(mockSupabase, 'user-1')).rejects.toEqual(
      expect.objectContaining({ message: 'DB error' })
    );
  });
});
