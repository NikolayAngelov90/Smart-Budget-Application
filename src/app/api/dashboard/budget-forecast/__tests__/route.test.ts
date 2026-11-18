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
  // Spread the real module so a NEW export (e.g. resolveClientToday) does not
  // silently become undefined and 500 the route.
  ...jest.requireActual('@/lib/utils/date'),
  toLocalISODate: jest.fn((d: Date) => d.toISOString().substring(0, 10)),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { computeEndOfMonthForecasts } from '@/lib/ai/forecastEngine';
import { GET } from '../route';

/**
 * GET now takes the request so it can read `?today=` — the client's local day,
 * because the server runs UTC and would otherwise put the month boundary in the
 * wrong place. Omitting the param falls back to the server clock, which is the
 * behaviour these tests already assume.
 */
const getRequest = (query = '') =>
  ({ url: `http://localhost:3000/api/dashboard/budget-forecast${query}` }) as Parameters<
    typeof GET
  >[0];

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockComputeForecasts = computeEndOfMonthForecasts as jest.MockedFunction<
  typeof computeEndOfMonthForecasts
>;

// Minimal chainable Supabase mock
function makeSupabaseMock(overrides: {
  user?: object | null;
  currentTx?: object[];
  historicalTx?: object[];
  categories?: object[];
  budgets?: object[];
  dbError?: object | null;
}) {
  const {
    user = { id: 'user-1' },
    currentTx = [],
    historicalTx = [],
    categories = [],
    budgets = [],
    dbError = null,
  } = overrides;

  /*
   * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The hand-rolled mock
   * dispatched by a CALL COUNTER (1 current tx, 2 historical tx, 3 categories,
   * 4+ budgets), correct only while the route's Promise.all keeps that order.
   * Per-table results need only the order WITHIN transactions: current month,
   * then history - which the "returns forecasts" test pins, because it asserts
   * the current-month rows reach the engine.
   */
  return createSupabaseMock({
    user: user as { id: string } | null,
    tables: {
      transactions: [
        { data: currentTx, error: dbError },
        { data: historicalTx, error: dbError },
      ],
      categories: { data: categories, error: dbError },
      category_budgets: { data: budgets, error: dbError }, // ADR-025
    },
  }).client;
}

describe('GET /api/dashboard/budget-forecast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeForecasts.mockReturnValue([]);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock({ user: null }) as never);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe('Unauthorized');
  });

  it('returns hasCurrentMonthData: false when no current-month transactions', async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock({ currentTx: [] }) as never);
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasCurrentMonthData).toBe(false);
    expect(body.forecasts).toHaveLength(0);
    expect(mockComputeForecasts).not.toHaveBeenCalled();
  });

  it('calls computeEndOfMonthForecasts and returns forecasts when data exists', async () => {
    const fakeTx = {
      id: 't1',
      user_id: 'user-1',
      category_id: 'cat-1',
      amount: 100,
      type: 'expense',
      date: '2026-06-05',
      notes: null,
      currency: 'USD',
      exchange_rate: null,
      created_at: '2026-06-05T00:00:00Z',
      updated_at: '2026-06-05T00:00:00Z',
    };
    const fakeForecast = {
      category_id: 'cat-1',
      category_name: 'Dining',
      category_color: '#aaa',
      spent_so_far: 100,
      projected_eom: 300,
      historical_avg: 200,
      is_at_risk: true,
      days_elapsed: 10,
      days_in_month: 30,
      budget_amount: 200,
      budget_source: 'historical_average' as const,
    };

    mockCreateClient.mockResolvedValue(makeSupabaseMock({ currentTx: [fakeTx] }) as never);
    mockComputeForecasts.mockReturnValue([fakeForecast]);

    const res = await GET(getRequest());
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
    // Auth succeeds, the reads fail. The route throws the current-month error
    // into its catch, which answers 500 - the same catch the old rejecting
    // chains reached. (The old test built a dbError client and then replaced
    // it before use; this keeps the one that was actually exercised.)
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ currentTx: [], dbError: { message: 'DB failure' } }) as never
    );

    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});
