/**
 * @jest-environment node
 */

/**
 * The four routes whose DATE-column windows were shifted into UTC.
 *
 * `transactions.date` is `DATE NOT NULL`. These routes built their window from
 * LOCAL-time Dates and then sent `.toISOString()`, so for anyone east of UTC
 * local midnight became the PREVIOUS UTC day and every window silently pulled
 * in an extra day of spend.
 *
 * The assertions are on the FILTER ARGUMENTS, not on call counts: an arg-blind
 * stub is precisely what let this survive since Epic 5.
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
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/services/valuesService', () => ({
  getValuesPlan: jest.fn().mockResolvedValue({ values: [], mappings: [] }),
}));
jest.mock('@/lib/ai/valuesSpendingEngine', () => ({
  computeValuesSpending: jest.fn().mockReturnValue({ values: [], unassigned: 0 }),
}));

import { createClient } from '@/lib/supabase/server';
import { GET as monthOverMonth } from '../month-over-month/route';
import { GET as spendingByCategory } from '../spending-by-category/route';
import { GET as trends } from '../trends/route';
import { GET as valuesSpending } from '../../values/spending/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface Captured {
  gte: string[];
  lte: string[];
  lt: string[];
  cols: string[];
}

/**
 * A chain that resolves on whichever terminal the route happens to use, so one
 * harness serves all four shapes (`.lte`, `.lt`, `.order`).
 */
function makeClient(captured: Captured) {
  const rows: unknown[] = [];
  const build = () => {
    const settle = () => Promise.resolve({ data: rows, error: null });
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      order: jest.fn(() => settle()),
      gte: jest.fn((col: string, v: string) => {
        captured.cols.push(col);
        captured.gte.push(v);
        return chain;
      }),
      lte: jest.fn((col: string, v: string) => {
        captured.cols.push(col);
        captured.lte.push(v);
        return Object.assign(settle(), chain);
      }),
      lt: jest.fn((col: string, v: string) => {
        captured.cols.push(col);
        captured.lt.push(v);
        return Object.assign(settle(), chain);
      }),
    };
    return chain;
  };
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    from: jest.fn(() => build()),
  };
}

const request = (query = '') =>
  ({ url: `http://localhost:3000/api/dashboard${query}` }) as never;

async function run(handler: (req: never) => Promise<unknown>, query = '') {
  const captured: Captured = { gte: [], lte: [], lt: [], cols: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateClient.mockResolvedValue(makeClient(captured) as any);
  await handler(request(query));
  return captured;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

beforeEach(() => {
  jest.clearAllMocks();
  // Late evening local: this is when toISOString() rolled the boundary back a
  // day for anyone east of UTC.
  jest.useFakeTimers().setSystemTime(new Date('2026-07-15T23:30:00'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DATE-column windows are plain yyyy-MM-dd, never ISO timestamps', () => {
  it('month-over-month sends bare dates for both months', async () => {
    const c = await run(monthOverMonth);

    expect(c.gte.length).toBeGreaterThan(0);
    [...c.gte, ...c.lte].forEach((v) => expect(v).toMatch(ISO_DATE));
    // Current month, then the previous one — on the user's calendar.
    expect(c.gte).toContain('2026-07-01');
    expect(c.lte).toContain('2026-07-31');
    expect(c.gte).toContain('2026-06-01');
    expect(c.lte).toContain('2026-06-30');
    expect(c.cols.every((col) => col === 'date')).toBe(true);
  });

  it('spending-by-category sends bare dates for the current month', async () => {
    const c = await run(spendingByCategory);

    [...c.gte, ...c.lte].forEach((v) => expect(v).toMatch(ISO_DATE));
    expect(c.gte).toContain('2026-07-01');
    expect(c.lte).toContain('2026-07-31');
  });

  it('spending-by-category honours the client local day over the server clock', async () => {
    // The server is still on the 15th; a user east of UTC is on the 16th. The
    // month is the same here, so what this pins is that the param is READ.
    const c = await run(spendingByCategory, '/spending-by-category?today=2026-07-16');
    expect(c.gte).toContain('2026-07-01');
    expect(c.lte).toContain('2026-07-31');
  });

  it('spending-by-category still accepts an explicit month', async () => {
    const c = await run(spendingByCategory, '/spending-by-category?month=2026-03');
    expect(c.gte).toContain('2026-03-01');
    expect(c.lte).toContain('2026-03-31');
  });

  it('trends sends bare dates across its multi-month range', async () => {
    const c = await run(trends);

    [...c.gte, ...c.lte].forEach((v) => expect(v).toMatch(ISO_DATE));
    // This route's range ends TODAY, not at month end — and "today" must be the
    // user's calendar day. At 23:30 local, toISOString() would have said the
    // 16th here for anyone east of UTC.
    expect(c.lte).toEqual(['2026-07-15']);
  });

  it('values/spending uses an exclusive upper bound, still as a bare date', async () => {
    const c = await run(valuesSpending);

    expect(c.gte).toEqual(['2026-06-01']);
    // `.lt` on the first of NEXT month — exclusive, so July is fully included.
    expect(c.lt).toEqual(['2026-08-01']);
    c.lt.forEach((v) => expect(v).toMatch(ISO_DATE));
  });

  it('no route sends a value containing a time component', async () => {
    for (const handler of [monthOverMonth, spendingByCategory, trends, valuesSpending]) {
      const c = await run(handler as (req: never) => Promise<unknown>);
      [...c.gte, ...c.lte, ...c.lt].forEach((v) => {
        expect(v).not.toContain('T');
        expect(v).not.toContain('Z');
      });
    }
  });
});
