/**
 * /api/values/spending route tests — Story 14.2
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

jest.mock('@/lib/services/valuesService', () => ({
  getValuesPlan: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getValuesPlan } from '@/lib/services/valuesService';
import { GET } from '../spending/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetPlan = getValuesPlan as jest.MockedFunction<typeof getValuesPlan>;

/** transactions query chain ending on `.lt()` (awaited). */
function txChain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'gte']) q[m] = jest.fn(() => q);
  q.lt = jest.fn(() => Promise.resolve(result));
  return q;
}

function client(user: object | null, txResult: { data: unknown; error: unknown }) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no user' } }) },
    from: jest.fn(() => txChain(txResult)),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/values/spending', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(client(null, { data: [], error: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetPlan).not.toHaveBeenCalled();
  });

  it('short-circuits to hasPlan=false when there is no values plan (no aggregation)', async () => {
    const c = client({ id: 'user-1' }, { data: [], error: null });
    mockCreateClient.mockResolvedValue(c as never);
    mockGetPlan.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data.hasPlan).toBe(false);
    expect(c.from).not.toHaveBeenCalled(); // never queried transactions
  });

  it('aggregates current vs previous month into a value-grouped view', async () => {
    // `transactions.date` is a DATE column → 'YYYY-MM-DD' strings.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const curDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-15`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevDate = `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}-15`;

    const c = client(
      { id: 'user-1' },
      {
        data: [
          { amount: 100, category_id: 'cA', date: curDate }, // current
          { amount: 30, category_id: 'cA', date: curDate }, // current
          { amount: 80, category_id: 'cA', date: prevDate }, // previous
          { amount: 50, category_id: 'cOther', date: curDate }, // current, unassigned
        ],
        error: null,
      }
    );
    mockCreateClient.mockResolvedValue(c as never);
    mockGetPlan.mockResolvedValue([{ id: 'v1', name: 'Health', priority: 0, category_ids: ['cA'] }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const view = (await res.json()).data;

    expect(view.hasPlan).toBe(true);
    expect(view.totalSpend).toBe(180); // 100 + 30 + 50 (current only)
    expect(view.values[0]).toMatchObject({ id: 'v1', amount: 130, percentage: 72 }); // 130/180
    // current 130 vs previous 80 = +62.5% → up
    expect(view.values[0].trendDirection).toBe('up');
    expect(view.unassigned).toEqual({ amount: 50, percentage: 28 });
  });

  it('returns 500 on a DB error', async () => {
    const c = client({ id: 'user-1' }, { data: null, error: { message: 'db down' } });
    mockCreateClient.mockResolvedValue(c as never);
    mockGetPlan.mockResolvedValue([{ id: 'v1', name: 'Health', priority: 0, category_ids: ['cA'] }]);

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
