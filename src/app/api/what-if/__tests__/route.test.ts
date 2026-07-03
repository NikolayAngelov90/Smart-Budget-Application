/**
 * @jest-environment node
 *
 * What-If Context API Route Tests — Story 14.4
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
 *
 * GET /api/what-if — category averages, subscription normalization,
 * nearest-goal pick, and honest degradation paths.
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

import { createClient } from '@/lib/supabase/server';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Chainable query stub: every method returns `this`; awaiting resolves to `result`.
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'order', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown }>;

function makeSupabase(plan: Plan = {}, user: object | null = { id: 'user-1' }) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: jest.fn((table: string) =>
      chain(plan[table] ?? { data: [], error: null })
    ),
  };
}

// Use month keys relative to "prior 3 months" — any past YYYY-MM works because
// averages bucket by the month-key string of whatever rows are returned.
const HISTORY = [
  { category_id: 'cat-1', amount: 300, exchange_rate: null, date: '2026-05-10' },
  { category_id: 'cat-1', amount: 500, exchange_rate: null, date: '2026-06-15' },
  { category_id: 'cat-2', amount: 90, exchange_rate: null, date: '2026-06-20' },
];

const CATEGORIES = [
  { id: 'cat-1', name: 'Dining', color: '#aaa' },
  { id: 'cat-2', name: 'Transport', color: '#bbb' },
  { id: 'cat-3', name: 'Never Used', color: '#ccc' },
];

beforeEach(() => jest.clearAllMocks());

describe('GET /api/what-if', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}, null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('computes per-category month-bucket averages, excludes zero-average categories, sorts desc', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: HISTORY, error: null },
        categories: { data: CATEGORIES, error: null },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hasData).toBe(true);
    expect(body.categories).toEqual([
      // cat-1: (300 + 500) / 2 months = 400
      { category_id: 'cat-1', name: 'Dining', color: '#aaa', avg_monthly: 400 },
      // cat-2: 90 / 1 month = 90
      { category_id: 'cat-2', name: 'Transport', color: '#bbb', avg_monthly: 90 },
      // cat-3 excluded (no spend)
    ]);
  });

  it('converts foreign-currency history via the stored rate', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: {
          data: [{ category_id: 'cat-1', amount: 100, exchange_rate: 2, date: '2026-06-01' }],
          error: null,
        },
        categories: { data: [CATEGORIES[0]], error: null },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(body.categories[0].avg_monthly).toBe(200);
  });

  it.each([
    ['weekly', 12, 52],
    ['monthly', 15, 15],
    ['quarterly', 30, 10],
    ['annual', 120, 10],
  ])('normalizes %s subscriptions to a monthly amount', async (frequency, amount, expected) => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: HISTORY, error: null },
        categories: { data: CATEGORIES, error: null },
        detected_subscriptions: {
          data: [{ id: 's-1', merchant_pattern: 'Netflix', estimated_amount: amount, frequency }],
          error: null,
        },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(body.subscriptions).toEqual([
      { id: 's-1', name: 'Netflix', monthly_amount: expected },
    ]);
  });

  it('picks the first unmet future-deadline goal', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: HISTORY, error: null },
        categories: { data: CATEGORIES, error: null },
        goals: {
          data: [
            { name: 'Met', target_amount: 100, current_amount: 100, deadline: '2199-01-01' },
            { name: 'Vacation', target_amount: 2000, current_amount: 500, deadline: '2199-06-01' },
          ],
          error: null,
        },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(body.goal).toEqual({
      name: 'Vacation',
      target_amount: 2000,
      current_amount: 500,
      deadline: '2199-06-01',
    });
  });

  it('degrades subscriptions and goal independently (AC #6)', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: HISTORY, error: null },
        categories: { data: CATEGORIES, error: null },
        detected_subscriptions: { data: null, error: { message: 'boom' } },
        goals: { data: null, error: { message: 'boom' } },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hasData).toBe(true);
    expect(body.subscriptions).toEqual([]);
    expect(body.goal).toBeNull();
  });

  it('returns hasData:false (empty state, no fabricated averages) when history fails', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: null, error: { message: 'relation missing' } },
        categories: { data: CATEGORIES, error: null },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ hasData: false, categories: [], subscriptions: [], goal: null });
  });

  it('returns hasData:false when no category has a positive average', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: [], error: null },
        categories: { data: CATEGORIES, error: null },
      }) as never
    );

    const res = await GET();
    const body = await res.json();
    expect(body.hasData).toBe(false);
    expect(body.categories).toEqual([]);
  });
});
