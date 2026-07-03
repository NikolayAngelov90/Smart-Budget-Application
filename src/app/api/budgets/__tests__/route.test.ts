/**
 * @jest-environment node
 *
 * Budgets API Route Tests — ADR-025
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
 *
 * GET /api/budgets — list with current-month spend + status
 * PUT /api/budgets — upsert a category budget
 * DELETE /api/budgets/:id — remove a budget
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

jest.mock('@/lib/services/budgetService', () => {
  const actual = jest.requireActual('@/lib/services/budgetService');
  return {
    ...actual,
    listBudgets: jest.fn(),
    upsertBudget: jest.fn(),
    deleteBudget: jest.fn(),
  };
});

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: jest.fn((d: Date) => d.toISOString().substring(0, 10)),
}));

import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listBudgets,
  upsertBudget,
  deleteBudget,
  BudgetNotFoundError,
  CategoryNotBudgetableError,
} from '@/lib/services/budgetService';
import { GET, PUT } from '../route';
import { DELETE } from '../[id]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockListBudgets = listBudgets as jest.MockedFunction<typeof listBudgets>;
const mockUpsertBudget = upsertBudget as jest.MockedFunction<typeof upsertBudget>;
const mockDeleteBudget = deleteBudget as jest.MockedFunction<typeof deleteBudget>;

// Chainable query stub: methods return `this`; awaiting resolves to `result`.
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'is']) {
    q[m] = jest.fn(() => q);
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

function makeSupabase(overrides: {
  user?: object | null;
  categories?: object[];
  transactions?: object[];
} = {}) {
  const { user = { id: 'user-1' }, categories = [], transactions = [] } = overrides;
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: jest.fn((table: string) => {
      if (table === 'categories') return chain({ data: categories, error: null });
      return chain({ data: transactions, error: null });
    }),
  };
}

const makeRequest = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

const BUDGET_ROW = {
  id: 'b-1',
  user_id: 'user-1',
  household_id: null,
  category_id: 'cat-1',
  period: 'monthly' as const,
  limit_amount: 300,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const VALID_UUID = '9f8b6a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/budgets', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ user: null }) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns an empty list without querying spend when no budgets exist', async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase as never);
    mockListBudgets.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.budgets).toEqual([]);
    expect(body.month).toMatch(/^\d{4}-\d{2}$/);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('computes spent, remaining, pct_used and status per budget', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        categories: [{ id: 'cat-1', name: 'Dining', color: '#aaa' }],
        transactions: [
          { category_id: 'cat-1', amount: 150 },
          { category_id: 'cat-1', amount: 90 },
        ],
      }) as never
    );
    mockListBudgets.mockResolvedValue([BUDGET_ROW]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.budgets).toHaveLength(1);
    expect(body.budgets[0]).toMatchObject({
      category_id: 'cat-1',
      category_name: 'Dining',
      limit_amount: 300,
      spent: 240,
      remaining: 60,
      pct_used: 80,
      status: 'warning',
    });
  });

  it('converts foreign-currency spend via the stored entry-time rate', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        categories: [{ id: 'cat-1', name: 'Dining', color: '#aaa' }],
        transactions: [
          { category_id: 'cat-1', amount: 100, exchange_rate: 2 }, // foreign → 200
          { category_id: 'cat-1', amount: 50, exchange_rate: null }, // preferred currency
        ],
      }) as never
    );
    mockListBudgets.mockResolvedValue([BUDGET_ROW]);

    const res = await GET();
    const body = await res.json();
    expect(body.budgets[0].spent).toBe(250);
  });

  it('sorts over-budget categories first', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        categories: [
          { id: 'cat-1', name: 'Dining', color: '#aaa' },
          { id: 'cat-2', name: 'Transport', color: '#bbb' },
        ],
        transactions: [
          { category_id: 'cat-1', amount: 10 }, // 3% of 300 → ok
          { category_id: 'cat-2', amount: 120 }, // 120% of 100 → over
        ],
      }) as never
    );
    mockListBudgets.mockResolvedValue([
      BUDGET_ROW,
      { ...BUDGET_ROW, id: 'b-2', category_id: 'cat-2', limit_amount: 100 },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.budgets[0].category_id).toBe('cat-2');
    expect(body.budgets[0].status).toBe('over');
    expect(body.budgets[0].remaining).toBe(-20);
    expect(body.budgets[1].status).toBe('ok');
  });
});

describe('PUT /api/budgets', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ user: null }) as never);
    const res = await PUT(makeRequest({ category_id: VALID_UUID, limit_amount: 100 }));
    expect(res.status).toBe(401);
  });

  it.each([
    ['negative amount', { category_id: VALID_UUID, limit_amount: -5 }],
    ['zero amount (surfaces must agree on 0 = no baseline)', { category_id: VALID_UUID, limit_amount: 0 }],
    ['amount above NUMERIC(12,2) capacity', { category_id: VALID_UUID, limit_amount: 10_000_000_000 }],
    ['3 decimal places', { category_id: VALID_UUID, limit_amount: 10.123 }],
    ['non-uuid category', { category_id: 'nope', limit_amount: 100 }],
    ['missing body', null],
  ])('returns 400 for %s', async (_label, body) => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await PUT(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mockUpsertBudget).not.toHaveBeenCalled();
  });

  it('saves a valid budget', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockUpsertBudget.mockResolvedValue(BUDGET_ROW);

    const res = await PUT(makeRequest({ category_id: VALID_UUID, limit_amount: 300 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(BUDGET_ROW);
    expect(mockUpsertBudget).toHaveBeenCalledWith('user-1', VALID_UUID, 300);
  });

  it('returns 404 when the category is not the caller’s', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockUpsertBudget.mockRejectedValue(new BudgetNotFoundError());
    const res = await PUT(makeRequest({ category_id: VALID_UUID, limit_amount: 300 }));
    expect(res.status).toBe(404);
  });

  it('returns 400 for income categories', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockUpsertBudget.mockRejectedValue(new CategoryNotBudgetableError('income'));
    const res = await PUT(makeRequest({ category_id: VALID_UUID, limit_amount: 300 }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/budgets/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({ user: null }) as never);
    const res = await DELETE(makeRequest(null), paramsFor(VALID_UUID));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-uuid id', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    const res = await DELETE(makeRequest(null), paramsFor('nope'));
    expect(res.status).toBe(400);
    expect(mockDeleteBudget).not.toHaveBeenCalled();
  });

  it('deletes an owned budget', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockDeleteBudget.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest(null), paramsFor(VALID_UUID));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteBudget).toHaveBeenCalledWith('user-1', VALID_UUID);
  });

  it('returns 404 for an unknown or foreign budget', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase() as never);
    mockDeleteBudget.mockRejectedValue(new BudgetNotFoundError());
    const res = await DELETE(makeRequest(null), paramsFor(VALID_UUID));
    expect(res.status).toBe(404);
  });
});
