/**
 * Dashboard stats route — period support (Story 16.6).
 *
 * The range arithmetic itself is covered in
 * `src/lib/utils/__tests__/dashboardPeriod.test.ts`. What matters here is the
 * wiring: that `period` reaches the QUERY, that the two queries cover the
 * selected window and the one before it, and — the part most likely to break
 * quietly — that requests without `period` behave exactly as they did before
 * this story, since other callers still make them.
 *
 * Filter arguments are asserted, not just call counts: an arg-blind stub lets
 * the whole period feature silently degrade to "current month" while every
 * test stays green.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/exchangeRateService', () => ({ getExchangeRates: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface Captured {
  gte: string[];
  lte: string[];
}

/**
 * Each `.from('transactions')` call returns a fresh chain, so the two queries
 * (current window, previous window) can be told apart by call order.
 */
function makeClient(rowsPerQuery: object[][], captured: Captured) {
  let call = 0;
  return {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn(() => {
      const index = call++;
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn((_col: string, value: string) => {
          captured.gte.push(value);
          return chain;
        }),
        lte: jest.fn((_col: string, value: string) => {
          captured.lte.push(value);
          return Promise.resolve({ data: rowsPerQuery[index] ?? [], error: null });
        }),
      };
      return chain;
    }),
  };
}

const request = (query: string) =>
  ({ url: `http://localhost:3000/api/dashboard/stats${query}` }) as Parameters<typeof GET>[0];

const run = async (query: string, rows: object[][] = [[], []]) => {
  const captured: Captured = { gte: [], lte: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateClient.mockResolvedValue(makeClient(rows, captured) as any);
  const res = await GET(request(query));
  return { body: await res.json(), captured, status: res.status };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-29T12:00:00'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GET /api/dashboard/stats — period', () => {
  it('queries the selected week and the week before it', async () => {
    const { body, captured } = await run('?period=week');

    expect(captured.gte).toEqual(['2026-07-27', '2026-07-20']);
    expect(captured.lte).toEqual(['2026-08-02', '2026-07-26']);
    expect(body.period).toBe('week');
    expect(body.periodStart).toBe('2026-07-27');
    expect(body.periodEnd).toBe('2026-08-02');
  });

  it('queries a rolling 3 months for quarter', async () => {
    const { body, captured } = await run('?period=quarter');

    expect(captured.gte).toEqual(['2026-05-01', '2026-02-01']);
    expect(captured.lte).toEqual(['2026-07-31', '2026-04-30']);
    expect(body.period).toBe('quarter');
  });

  it('queries the calendar year and the previous year', async () => {
    const { captured } = await run('?period=year');

    expect(captured.gte).toEqual(['2026-01-01', '2025-01-01']);
    expect(captured.lte).toEqual(['2026-12-31', '2025-12-31']);
  });

  it('defaults to the current month when no period is given', async () => {
    const { body, captured } = await run('');

    expect(captured.gte).toEqual(['2026-07-01', '2026-06-01']);
    expect(captured.lte).toEqual(['2026-07-31', '2026-06-30']);
    expect(body.period).toBe('month');
  });

  it('falls back to month for an unrecognised period instead of failing', async () => {
    const { body, captured } = await run('?period=fortnight');

    expect(captured.gte).toEqual(['2026-07-01', '2026-06-01']);
    expect(body.period).toBe('month');
  });

  it('keeps month=YYYY-MM pinned to that month, ignoring period', async () => {
    const { body, captured } = await run('?month=2026-03&period=year');

    expect(captured.gte).toEqual(['2026-03-01', '2026-02-01']);
    expect(captured.lte).toEqual(['2026-03-31', '2026-02-28']);
    expect(body.month).toBe('2026-03');
    expect(body.period).toBe('month');
  });

  it('aggregates the selected window into balance/income/expenses', async () => {
    const { body } = await run('?period=week', [
      [
        { amount: 2000, type: 'income' },
        { amount: 500, type: 'expense' },
      ],
      [{ amount: 1000, type: 'income' }],
    ]);

    expect(body.income.current).toBe(2000);
    expect(body.expenses.current).toBe(500);
    expect(body.balance).toBe(1500);
    // Previous window feeds the trend chip.
    expect(body.income.previous).toBe(1000);
  });

  it('returns 401 without a session', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest
          .fn()
          .mockResolvedValue({ data: { user: null }, error: { message: 'no session' } }),
      },
      from: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await GET(request('?period=week'));
    expect(res.status).toBe(401);
  });
});
