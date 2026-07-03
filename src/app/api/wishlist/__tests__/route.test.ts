/**
 * @jest-environment node
 *
 * Wishlist API Route Tests — Story 14.3
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
 *
 * GET /api/wishlist — items with read-time impact (real engine, mocked data layer)
 * POST /api/wishlist — create with zod validation
 * PATCH /api/wishlist/:id — status transitions
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

jest.mock('@/lib/services/wishlistService', () => {
  const actual = jest.requireActual('@/lib/services/wishlistService');
  return {
    ...actual,
    listWishlist: jest.fn(),
    createItem: jest.fn(),
    updateStatus: jest.fn(),
  };
});

jest.mock('@/lib/services/valuesService', () => ({
  getValuesPlan: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: jest.fn((d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }),
}));

import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listWishlist,
  createItem,
  updateStatus,
  WishlistCategoryError,
  WishlistItemNotFoundError,
} from '@/lib/services/wishlistService';
import { getValuesPlan } from '@/lib/services/valuesService';
import { GET, POST } from '../route';
import { PATCH } from '../[id]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockListWishlist = listWishlist as jest.MockedFunction<typeof listWishlist>;
const mockCreateItem = createItem as jest.MockedFunction<typeof createItem>;
const mockUpdateStatus = updateStatus as jest.MockedFunction<typeof updateStatus>;
const mockGetValuesPlan = getValuesPlan as jest.MockedFunction<typeof getValuesPlan>;

// Chainable query stub: every method returns `this`; awaiting resolves to `result`.
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'lte', 'in', 'is', 'not', 'order', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>;

function makeSupabase(plan: Plan = {}, user: object | null = { id: 'user-1' }) {
  const queues: Record<string, { data: unknown; error: unknown }[] | { data: unknown; error: unknown }> = {};
  for (const [k, v] of Object.entries(plan)) queues[k] = Array.isArray(v) ? [...v] : v;
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: jest.fn((table: string) => {
      const q = queues[table];
      let result: { data: unknown; error: unknown } = { data: [], error: null };
      if (Array.isArray(q)) result = q.length ? q.shift()! : { data: [], error: null };
      else if (q) result = q;
      return chain(result);
    }),
  };
}

const makeRequest = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

const VALID_UUID = '9f8b6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

const ITEM = {
  id: 'w-1',
  user_id: 'user-1',
  category_id: 'cat-1',
  name: 'Headphones',
  price: 100,
  status: 'active' as const,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

// A goal comfortably in the future so delay_days is stable-positive on any run date
const FUTURE_GOAL = {
  name: 'Vacation',
  target_amount: 2000,
  current_amount: 1000,
  deadline: '2199-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesPlan.mockResolvedValue([]);
});

describe('GET /api/wishlist', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}, null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('short-circuits with an empty list (no impact queries)', async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase as never);
    mockListWishlist.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('enriches items with month balance, budget, goal delay and value alignment', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: [
          // month totals query
          {
            data: [
              { amount: 2000, type: 'income', exchange_rate: null },
              { amount: 1500, type: 'expense', exchange_rate: null },
            ],
            error: null,
          },
          // per-category spend query (cat-1 has a budget)
          { data: [{ category_id: 'cat-1', amount: 120, exchange_rate: null }], error: null },
        ],
        category_budgets: { data: [{ category_id: 'cat-1', limit_amount: 300 }], error: null },
        goals: { data: [FUTURE_GOAL], error: null },
        categories: { data: [{ id: 'cat-1', name: 'Electronics' }], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([ITEM]);
    mockGetValuesPlan.mockResolvedValue([
      { id: 'v-1', name: 'Fun', priority: 1, category_ids: ['cat-1'] },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item.category_name).toBe('Electronics');
    expect(item.impact.month_balance_after).toBe(400); // 2000 - 1500 - 100
    expect(item.impact.category_budget).toMatchObject({
      category_name: 'Electronics',
      limit_amount: 300,
      remaining_after: 80, // 300 - 120 - 100
      exceeds_budget: false,
    });
    expect(item.impact.goal_delay?.goal_name).toBe('Vacation');
    expect(item.impact.goal_delay?.delay_days).toBeGreaterThan(0);
    expect(item.impact.aligned_value).toBe('Fun');
  });

  it('degrades enrichments independently when optional data fails (AC #7)', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: {
          data: [{ amount: 500, type: 'income', exchange_rate: null }],
          error: null,
        },
        // migration 033/032 not applied scenario
        category_budgets: { data: null, error: { message: 'relation does not exist' } },
        goals: { data: null, error: { message: 'boom' } },
        categories: { data: [{ id: 'cat-1', name: 'Electronics' }], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([ITEM]);
    mockGetValuesPlan.mockRejectedValue(new Error('no plan'));

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    const item = body.items[0];
    expect(item.impact.month_balance_after).toBe(400); // 500 - 0 - 100
    expect(item.impact.category_budget).toBeNull();
    expect(item.impact.goal_delay).toBeNull();
    expect(item.impact.aligned_value).toBeNull();
  });

  it('nulls the month balance (never fabricates −price) when month totals fail', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: null, error: { message: 'boom' } },
        categories: { data: [], error: null },
        goals: { data: [], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([{ ...ITEM, category_id: null }]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items[0].impact.month_balance_after).toBeNull();
  });

  it('suppresses the budget line (never spent:0) when the spend query fails', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: [
          { data: [{ amount: 2000, type: 'income', exchange_rate: null }], error: null },
          { data: null, error: { message: 'boom' } }, // per-category spend query
        ],
        category_budgets: { data: [{ category_id: 'cat-1', limit_amount: 300 }], error: null },
        goals: { data: [], error: null },
        categories: { data: [{ id: 'cat-1', name: 'Electronics' }], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([ITEM]);

    const res = await GET();
    const body = await res.json();
    expect(body.items[0].impact.category_budget).toBeNull();
    // Month balance is unaffected by the spend-query failure
    expect(body.items[0].impact.month_balance_after).toBe(1900);
  });

  it('returns null impact projections for purchased/removed items', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: {
          data: [{ amount: 2000, type: 'income', exchange_rate: null }],
          error: null,
        },
        category_budgets: { data: [{ category_id: 'cat-1', limit_amount: 300 }], error: null },
        goals: { data: [FUTURE_GOAL], error: null },
        categories: { data: [{ id: 'cat-1', name: 'Electronics' }], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([{ ...ITEM, status: 'purchased' }]);

    const res = await GET();
    const body = await res.json();
    const impact = body.items[0].impact;
    expect(impact.month_balance_after).toBeNull();
    expect(impact.category_budget).toBeNull();
    expect(impact.goal_delay).toBeNull();
  });

  it('converts foreign-currency month totals via the stored rate', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: {
          data: [{ amount: 100, type: 'income', exchange_rate: 2 }],
          error: null,
        },
        categories: { data: [], error: null },
        goals: { data: [], error: null },
      }) as never
    );
    mockListWishlist.mockResolvedValue([{ ...ITEM, category_id: null }]);

    const res = await GET();
    const body = await res.json();
    expect(body.items[0].impact.month_balance_after).toBe(100); // 200 - 0 - 100
  });
});

describe('POST /api/wishlist', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}, null) as never);
    const res = await POST(makeRequest({ name: 'X', price: 10 }));
    expect(res.status).toBe(401);
  });

  it.each([
    ['zero price', { name: 'X', price: 0 }],
    ['negative price', { name: 'X', price: -5 }],
    ['3 decimal places', { name: 'X', price: 10.123 }],
    ['empty name', { name: '  ', price: 10 }],
    ['name over 100 chars', { name: 'x'.repeat(101), price: 10 }],
    ['non-uuid category', { name: 'X', price: 10, category_id: 'nope' }],
    ['missing body', null],
  ])('returns 400 for %s', async (_label, body) => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it('creates an item and returns 201', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockCreateItem.mockResolvedValue(ITEM);

    const res = await POST(makeRequest({ name: 'Headphones', price: 100, category_id: VALID_UUID }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data).toEqual(ITEM);
    expect(mockCreateItem).toHaveBeenCalledWith('user-1', 'Headphones', 100, VALID_UUID);
  });

  it.each([
    ['name at exactly 100 chars', { name: 'x'.repeat(100), price: 10 }],
    ['price at the minimum granularity', { name: 'X', price: 0.01 }],
    ['large 2-decimal price (float-epsilon regression)', { name: 'X', price: 1234567890.12 }],
    ['price at the max cap', { name: 'X', price: 9_999_999_999.99 }],
  ])('accepts boundary input: %s', async (_label, body) => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockCreateItem.mockResolvedValue(ITEM);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(201);
  });

  it('maps WishlistCategoryError to 400', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockCreateItem.mockRejectedValue(new WishlistCategoryError('Category not found'));
    const res = await POST(makeRequest({ name: 'X', price: 10, category_id: VALID_UUID }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/wishlist/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}, null) as never);
    const res = await PATCH(makeRequest({ status: 'purchased' }), paramsFor(VALID_UUID));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-uuid id', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await PATCH(makeRequest({ status: 'purchased' }), paramsFor('nope'));
    expect(res.status).toBe(400);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid status', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await PATCH(makeRequest({ status: 'bought' }), paramsFor(VALID_UUID));
    expect(res.status).toBe(400);
  });

  it('updates the status', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockUpdateStatus.mockResolvedValue({ ...ITEM, status: 'purchased' });

    const res = await PATCH(makeRequest({ status: 'purchased' }), paramsFor(VALID_UUID));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe('purchased');
    expect(mockUpdateStatus).toHaveBeenCalledWith('user-1', VALID_UUID, 'purchased');
  });

  it('returns 404 for an unknown or foreign item', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockUpdateStatus.mockRejectedValue(new WishlistItemNotFoundError());
    const res = await PATCH(makeRequest({ status: 'removed' }), paramsFor(VALID_UUID));
    expect(res.status).toBe(404);
  });
});
