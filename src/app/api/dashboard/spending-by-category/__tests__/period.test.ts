/**
 * @jest-environment node
 */

/**
 * `?period=` on the category donut — HP-1.
 *
 * The donut follows the dashboard period selector, so this route now resolves
 * four windows instead of one. What is worth pinning is not that the numbers add
 * up — the aggregation was already covered — but the WINDOW: which day strings
 * reach the `date` column, which parameter wins when two are supplied, and what
 * an unrecognised period does.
 *
 * Uses the shared chain mock so a filter the route adds later cannot silently
 * turn into a 500 here.
 */

import { NextRequest } from 'next/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { GET } from '../route';

const USER = 'user-1';
/** A Wednesday, deliberately mid-month and mid-week. */
const TODAY = '2026-07-15';

// `resolveClientToday` clamps `?today=` to +/-1 day of the SERVER's date, so a
// stale or hostile client cannot shift the window arbitrarily. The server clock
// therefore has to be pinned alongside the parameter, or every window silently
// snaps back to the real today and the assertions below stop meaning anything.
beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(new Date(`${TODAY}T09:00:00`));
});

afterAll(() => {
  jest.useRealTimers();
});

function makeDb(rows: unknown[] = []) {
  const db = createSupabaseMock({
    tables: { transactions: { data: rows, error: null } },
    user: { id: USER },
  });
  mockCreateClient.mockResolvedValue(db.client);
  return db;
}

function call(query: string) {
  return GET(new NextRequest(`http://localhost/api/dashboard/spending-by-category${query}`));
}

/** The `[gte, lte]` day strings the route sent to the DATE column. */
function windowOf(db: ReturnType<typeof makeDb>): [string, string] {
  const gte = db.allCallsTo('transactions', 'gte').find((a) => a[0] === 'date');
  const lte = db.allCallsTo('transactions', 'lte').find((a) => a[0] === 'date');
  return [gte![1] as string, lte![1] as string];
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('period windows', () => {
  it.each([
    // Monday-start week containing Wed 15 Jul 2026 -> 13th..19th.
    ['week', '2026-07-13', '2026-07-19'],
    ['month', '2026-07-01', '2026-07-31'],
    // Rolling 3 months: May, June, July — not the calendar quarter, because the
    // control is labelled "3 Months".
    ['quarter', '2026-05-01', '2026-07-31'],
    ['year', '2026-01-01', '2026-12-31'],
  ])('?period=%s aggregates %s..%s', async (period, start, end) => {
    const db = makeDb();

    await call(`?period=${period}&today=${TODAY}`);

    expect(windowOf(db)).toEqual([start, end]);
  });

  it('defaults to the month when no period is given', async () => {
    const db = makeDb();

    await call(`?today=${TODAY}`);

    expect(windowOf(db)).toEqual(['2026-07-01', '2026-07-31']);
  });

  it('falls back to the month for an unrecognised period', async () => {
    // A chart that renders the default window beats one that renders an error
    // because a stale client sent a period this build no longer knows.
    const db = makeDb();

    const response = await call(`?period=fortnight&today=${TODAY}`);

    expect(response.status).toBe(200);
    expect(windowOf(db)).toEqual(['2026-07-01', '2026-07-31']);
    await expect(response.json()).resolves.toMatchObject({ period: 'month' });
  });

  it('lets an explicit ?month= win over ?period=', async () => {
    // `?month=` is a drill-down at a named month; it has no "year" reading.
    const db = makeDb();

    await call(`?month=2026-03&period=year&today=${TODAY}`);

    expect(windowOf(db)).toEqual(['2026-03-01', '2026-03-31']);
  });

  it('echoes the window it actually aggregated', async () => {
    // The client labels from THIS, not from its own pending selection —
    // keepPreviousData holds the outgoing figures on screen while the next
    // window loads, so labelling by selection prints "This year" over last
    // month's money (the Story 16-6 lesson).
    makeDb();

    const body = await (await call(`?period=year&today=${TODAY}`)).json();

    expect(body.period).toBe('year');
  });

  it('keeps `month` in the response for the categories screen', async () => {
    makeDb();

    const body = await (await call(`?period=week&today=${TODAY}`)).json();

    expect(body.month).toBe('2026-07');
  });
});

describe('window boundaries stay on the user calendar day', () => {
  it('sends yyyy-MM-dd strings, never ISO timestamps', async () => {
    // `transactions.date` is a DATE column: local midnight through toISOString()
    // lands on the PREVIOUS UTC day for anyone east of UTC.
    const db = makeDb();

    await call(`?period=month&today=${TODAY}`);

    for (const bound of windowOf(db)) {
      expect(bound).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('honours the client day across a month boundary', async () => {
    // The real failure: server still on 31 Jul, user already on 1 Aug. The
    // transaction they just logged must land in the window they are looking at.
    jest.setSystemTime(new Date('2026-07-31T22:30:00'));
    const db = makeDb();

    await call('?period=month&today=2026-08-01');

    expect(windowOf(db)).toEqual(['2026-08-01', '2026-08-31']);
    jest.setSystemTime(new Date(`${TODAY}T09:00:00`));
  });

  it('ignores a client day beyond the clamp', async () => {
    // A stale or hostile value must not shift the window arbitrarily.
    const db = makeDb();

    await call('?period=month&today=2026-01-05');

    expect(windowOf(db)).toEqual(['2026-07-01', '2026-07-31']);
  });
});

describe('currency conversion (D3)', () => {
  // This route summed raw `amount`, so a mixed-currency donut added 100 USD to
  // 100 EUR and labelled the result with the user's preferred symbol. DW-1
  // fixed exactly this for /budgets, /wishlist and /what-if and skipped here;
  // widening the window to a year made one foreign trip permanently visible.
  const cat = { id: 'c1', name: 'Groceries', color: '#0B5E4A' };

  it('applies the stored entry-time rate', async () => {
    const db = makeDb([
      { amount: 100, category_id: 'c1', currency: 'EUR', exchange_rate: null, categories: cat },
      // 50 USD at a stored 0.9 -> 45 preferred.
      { amount: 50, category_id: 'c1', currency: 'USD', exchange_rate: 0.9, categories: cat },
    ]);
    mockCreateClient.mockResolvedValue(db.client);

    const body = await (await call(`?period=month&today=${TODAY}`)).json();

    expect(body.total).toBeCloseTo(145, 5);
  });

  it('does not convert rows already in the preferred currency', async () => {
    // `currency = NULL` means "already preferred" — treating it as foreign
    // would double-convert.
    const db = makeDb([
      { amount: 100, category_id: 'c1', currency: null, exchange_rate: null, categories: cat },
    ]);
    mockCreateClient.mockResolvedValue(db.client);

    const body = await (await call(`?period=month&today=${TODAY}`)).json();

    expect(body.total).toBe(100);
  });

  it('leaves a row unconverted rather than failing the whole donut', async () => {
    // Degradation policy: a missing rate is an ENRICHMENT failure — warn and
    // carry the raw amount. A 500 here would blank the chart and poison the
    // SWR localStorage cache.
    const db = makeDb([
      { amount: 100, category_id: 'c1', currency: 'XYZ', exchange_rate: null, categories: cat },
    ]);
    mockCreateClient.mockResolvedValue(db.client);

    const response = await call(`?period=month&today=${TODAY}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ total: 100 });
  });
});

describe('the window bounds are published (D2)', () => {
  it('echoes the real start and end, not just the anchor month', async () => {
    // The drill-down navigates with these. It used to use `month`, so a slice
    // worth a year opened a single month's transactions.
    makeDb();

    const body = await (await call(`?period=year&today=${TODAY}`)).json();

    expect(body).toMatchObject({ start: '2026-01-01', end: '2026-12-31', month: '2026-07' });
  });

  it('publishes bounds for a week that straddles a month edge', async () => {
    jest.setSystemTime(new Date('2026-08-01T09:00:00'));
    makeDb();

    const body = await (await call('?period=week&today=2026-08-01')).json();

    // The `month` echo says August while the window starts in July — which is
    // exactly why the drill-down cannot rely on it.
    expect(body).toMatchObject({ start: '2026-07-27', end: '2026-08-02' });
    jest.setSystemTime(new Date(`${TODAY}T09:00:00`));
  });
});

describe('scoping', () => {
  it('filters to the signed-in user and to expenses', async () => {
    const db = makeDb();

    await call(`?period=year&today=${TODAY}`);

    const eqCalls = db.allCallsTo('transactions', 'eq');
    expect(eqCalls).toContainEqual(['user_id', USER]);
    expect(eqCalls).toContainEqual(['type', 'expense']);
  });

  it('rejects an unauthenticated request', async () => {
    const db = createSupabaseMock({ user: null });
    mockCreateClient.mockResolvedValue(db.client);

    const response = await call(`?period=month&today=${TODAY}`);

    expect(response.status).toBe(401);
  });
});
