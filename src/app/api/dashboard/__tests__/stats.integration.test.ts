/**
 * Dashboard Stats API Integration Tests
 * Story 10.9: AC-10.9.4 — Dashboard data aggregation integration tests
 *
 * Tests GET /api/dashboard/stats covering:
 * - Correct income/expense aggregation and balance calculation
 * - Month parameter changes date range
 * - Trend calculation (current vs previous month)
 * - Multi-currency conversion with stored exchange_rate
 * - Multi-currency conversion using live rate when exchange_rate is null
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      headers: new Headers(),
    })),
  },
}));

import { GET } from '@/app/api/dashboard/stats/route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock exchange rate service to avoid live API calls
jest.mock('@/lib/services/exchangeRateService', () => ({
  getExchangeRates: jest.fn().mockResolvedValue({
    base: 'EUR',
    rates: { USD: 1.08, GBP: 0.86, EUR: 1 },
    date: '2026-01-01',
    cached: true,
    lastFetched: '2026-01-01T00:00:00Z',
  }),
}));

import { getExchangeRates } from '@/lib/services/exchangeRateService';
const mockGetExchangeRates = getExchangeRates as jest.MockedFunction<
  typeof getExchangeRates
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(url: string): any {
  return {
    url,
    method: 'GET',
    headers: new Headers(),
    nextUrl: new URL(url),
  };
}

describe('Dashboard Stats Integration Tests (AC-10.9.4)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQuery: any;

  const userId = 'user-123';

  // Current month: January 2026 income/expense data (all EUR, no conversion needed)
  const currentMonthTransactions = [
    { amount: 3000, type: 'income', currency: 'EUR', exchange_rate: null },
    { amount: 1200, type: 'expense', currency: 'EUR', exchange_rate: null },
    { amount: 500, type: 'expense', currency: 'EUR', exchange_rate: null },
  ];

  // Previous month: December 2025
  const previousMonthTransactions = [
    { amount: 2800, type: 'income', currency: 'EUR', exchange_rate: null },
    { amount: 1100, type: 'expense', currency: 'EUR', exchange_rate: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    let callCount = 0;
    const responses = [
      { data: currentMonthTransactions, error: null },
      { data: previousMonthTransactions, error: null },
    ];

    mockQuery = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (v: unknown) => void) => {
        const response = responses[callCount % responses.length] ?? { data: [], error: null };
        callCount++;
        return Promise.resolve(response).then(resolve);
      }),
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      from: jest.fn(() => mockQuery),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);

    // Reset exchange rate mock to default
    mockGetExchangeRates.mockResolvedValue({
      base: 'EUR',
      rates: { USD: 1.08, GBP: 0.86, EUR: 1 },
      date: '2026-01-01',
      cached: true,
      lastFetched: '2026-01-01T00:00:00Z',
    });
  });

  test('returns correct income, expenses, and balance for current month', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?month=2026-01'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Income: 3000, Expenses: 1200 + 500 = 1700, Balance: 1300
    expect(data.income.current).toBe(3000);
    expect(data.expenses.current).toBe(1700);
    expect(data.balance).toBe(1300);
  });

  test('returns trend comparing current vs previous month', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?month=2026-01'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Previous income: 2800, current: 3000 — positive trend
    expect(data.income.previous).toBe(2800);
    expect(data.income.trend).toBeGreaterThan(0);
    // Previous expenses: 1100, current: 1700 — positive trend (increased spending)
    expect(data.expenses.previous).toBe(1100);
    expect(data.expenses.trend).toBeGreaterThan(0);
  });

  test('returns correct month format in response', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?month=2026-01'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(data.month).toBe('2026-01');
  });

  test('uses current month when no month param provided', async () => {
    const request = createMockRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Month queries should have been made
    expect(mockQuery.gte).toHaveBeenCalled();
    expect(mockQuery.lte).toHaveBeenCalled();
  });

  test('returns 401 when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });

    const request = createMockRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  test('applies stored exchange_rate when currency differs from preferred', async () => {
    // USD transaction with stored exchange_rate of 0.93 (USD→EUR)
    const usdTransactions = [
      { amount: 100, type: 'expense', currency: 'USD', exchange_rate: 0.93 },
    ];

    let callCount = 0;
    mockQuery.then.mockImplementation((resolve: (v: unknown) => void) => {
      const responses = [
        { data: usdTransactions, error: null },
        { data: [], error: null },
      ];
      const response = responses[callCount % 2];
      callCount++;
      return Promise.resolve(response).then(resolve);
    });

    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?currency=EUR'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // 100 USD * 0.93 = 93 EUR (stored rate used)
    expect(data.expenses.current).toBeCloseTo(93, 1);
    // Live rate NOT called because exchange_rate was stored
    expect(mockGetExchangeRates).not.toHaveBeenCalled();
  });

  test('fetches live rate when exchange_rate is null and currency differs', async () => {
    // EUR transaction with no stored exchange_rate — needs live USD conversion
    const eurWithoutRate = [
      { amount: 100, type: 'expense', currency: 'EUR', exchange_rate: null },
    ];

    let callCount = 0;
    mockQuery.then.mockImplementation((resolve: (v: unknown) => void) => {
      const responses = [
        { data: eurWithoutRate, error: null },
        { data: [], error: null },
      ];
      const response = responses[callCount % 2];
      callCount++;
      return Promise.resolve(response).then(resolve);
    });

    // USD is preferred currency, EUR transactions have no stored rate
    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?currency=USD'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Live rate: 1 EUR = 1.08 USD → 100 EUR * 1.08 = 108 USD
    expect(data.expenses.current).toBeCloseTo(108, 1);
    expect(mockGetExchangeRates).toHaveBeenCalledWith('EUR');
  });

  test('does not fetch live rates when all transactions match preferred currency', async () => {
    // EUR transactions with preferred currency EUR — no conversion needed
    const request = createMockRequest(
      'http://localhost:3000/api/dashboard/stats?currency=EUR'
    );
    await GET(request);

    expect(mockGetExchangeRates).not.toHaveBeenCalled();
  });

  test('returns 500 when database query fails', async () => {
    mockQuery.then.mockImplementation((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: new Error('DB error') }).then(resolve)
    );

    const request = createMockRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  test('balance is zero when no transactions exist', async () => {
    mockQuery.then.mockImplementation((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    const request = createMockRequest('http://localhost:3000/api/dashboard/stats');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.balance).toBe(0);
    expect(data.income.current).toBe(0);
    expect(data.expenses.current).toBe(0);
  });
});
