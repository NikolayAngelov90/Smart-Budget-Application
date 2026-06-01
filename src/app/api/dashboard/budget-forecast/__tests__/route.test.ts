/**
 * Budget Forecast API Route Tests
 * Story 12.2: End-of-Month Budget Projections
 *
 * Tests for GET /api/dashboard/budget-forecast
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/ai/forecastEngine', () => ({
  computeEndOfMonthForecasts: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: jest.fn((d: Date) => d.toISOString().substring(0, 10)),
}));

import { createClient } from '@/lib/supabase/server';
import { computeEndOfMonthForecasts } from '@/lib/ai/forecastEngine';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockComputeForecasts = computeEndOfMonthForecasts as jest.MockedFunction<typeof computeEndOfMonthForecasts>;

// Minimal chainable Supabase mock
function makeSupabaseMock(overrides: {
  user?: object | null;
  authError?: object | null;
  currentTx?: object[];
  historicalTx?: object[];
  categories?: object[];
  dbError?: object | null;
}) {
  const { user = { id: 'user-1' }, authError = null, currentTx = [], historicalTx = [], categories = [], dbError = null } = overrides;

  const makeQueryChain = (data: object[], error: object | null = null) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({ data, error }),
      order: jest.fn().mockResolvedValue({ data, error }),
    };
    // make the terminal call resolve
    chain.lte.mockResolvedValue({ data, error });
    chain.lt.mockResolvedValue({ data, error });
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    return chain;
  };

  let callCount = 0;
  const mockFrom = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return makeQueryChain(currentTx, dbError);
    if (callCount === 2) return makeQueryChain(historicalTx, dbError);
    return makeQueryChain(categories, dbError);
  });

  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: authError }) },
    from: mockFrom,
  };
}

describe('GET /api/dashboard/budget-forecast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeForecasts.mockReturnValue([]);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock({ user: null, authError: { message: 'No session' } }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Unauthorized');
  });

  it('returns hasCurrentMonthData: false when no current-month transactions', async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock({ currentTx: [] }) as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasCurrentMonthData).toBe(false);
    expect(body.forecasts).toHaveLength(0);
    expect(mockComputeForecasts).not.toHaveBeenCalled();
  });

  it('calls computeEndOfMonthForecasts and returns forecasts when data exists', async () => {
    const fakeTx = { id: 't1', user_id: 'user-1', category_id: 'cat-1', amount: 100, type: 'expense', date: '2026-06-05', notes: null, currency: 'USD', exchange_rate: null, created_at: '2026-06-05T00:00:00Z', updated_at: '2026-06-05T00:00:00Z' };
    const fakeForecast = { category_id: 'cat-1', category_name: 'Dining', category_color: '#aaa', spent_so_far: 100, projected_eom: 300, historical_avg: 200, is_at_risk: true, days_elapsed: 10, days_in_month: 30 };

    mockCreateClient.mockResolvedValue(makeSupabaseMock({ currentTx: [fakeTx] }) as never);
    mockComputeForecasts.mockReturnValue([fakeForecast]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasCurrentMonthData).toBe(true);
    expect(body.forecasts).toHaveLength(1);
    expect(body.forecasts[0].category_id).toBe('cat-1');
    expect(mockComputeForecasts).toHaveBeenCalledWith(
      expect.objectContaining({ currentMonthTransactions: [fakeTx] })
    );
  });

  it('returns 500 on database error', async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock({ currentTx: [], dbError: { message: 'DB error' } }) as never);
    // Make auth succeed but DB fail
    const mockClient = makeSupabaseMock({ currentTx: [] });
    mockClient.from = jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockRejectedValue(new Error('DB failure')),
      lt: jest.fn().mockRejectedValue(new Error('DB failure')),
    }));
    mockCreateClient.mockResolvedValue(mockClient as never);

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
