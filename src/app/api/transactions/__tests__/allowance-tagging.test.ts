/**
 * POST /api/transactions — allowance tagging (Story 13.6)
 *
 * Verifies that tagging a transaction to a personal allowance forces it personal
 * (household_id NULL) and that a shared category cannot be tagged.
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({ json: async () => data, status: init?.status || 200, headers: new Headers() })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(() => ({})),
}));
jest.mock('@/lib/services/insightService', () => ({
  checkAndTriggerForTransactionCount: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/ai/nudgeEngine', () => ({ evaluateNudge: jest.fn(() => null) }));
jest.mock('@/lib/services/pushService', () => ({ dispatchCategorizedPush: jest.fn().mockResolvedValue('sent') }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/transactions/route';
import { createClient } from '@/lib/supabase/server';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const PERSONAL_CAT = { id: 'cat-p', name: 'Snacks', color: '#111111', type: 'expense', household_id: null };
const SHARED_CAT = { id: 'cat-s', name: 'Groceries', color: '#222222', type: 'expense', household_id: 'h-1' };
const ALLOWANCE = { id: 'allw-1' };

interface MockOpts {
  category: object | null;
  allowance?: object | null;
}

let insertArg: Record<string, unknown> | null;

function makeClient({ category, allowance = ALLOWANCE }: MockOpts) {
  insertArg = null;
  const universal = (table: string) => {
    const q: Record<string, jest.Mock> = {};
    for (const m of ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'not']) q[m] = jest.fn(() => q);
    q.insert = jest.fn((arg: Record<string, unknown>) => {
      insertArg = arg;
      return q;
    });
    q.single = jest.fn().mockResolvedValue(
      table === 'categories'
        ? { data: category, error: category ? null : { message: 'x' } }
        : table === 'transactions'
          ? { data: { id: 'tx-new', ...(insertArg ?? {}) }, error: null }
          : { data: { preferences: {} }, error: null }
    );
    q.maybeSingle = jest.fn().mockResolvedValue(
      table === 'personal_allowances'
        ? { data: allowance, error: null }
        : { data: { preferences: {} }, error: null }
    );
    // Awaited filter chains (nudge selects, goals) resolve empty.
    (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null });
    return q;
  };
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: jest.fn((t: string) => universal(t)),
  };
}

function req(body: unknown) {
  return { json: async () => body } as never;
}

const base = { amount: 10, type: 'expense', date: '2026-06-05' };

beforeEach(() => jest.clearAllMocks());

it('tagging a personal-category expense to the allowance forces household_id NULL', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: PERSONAL_CAT }) as never);
  const res = await POST(req({ ...base, category_id: 'cat-p', allowance_id: 'allw-1' }));
  expect(res.status).toBe(201);
  expect(insertArg?.allowance_id).toBe('allw-1');
  expect(insertArg?.household_id).toBeNull();
});

it('rejects tagging a SHARED category to the allowance (400)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: SHARED_CAT }) as never);
  const res = await POST(req({ ...base, category_id: 'cat-s', allowance_id: 'allw-1' }));
  expect(res.status).toBe(400);
});

it('rejects an unknown allowance id (400)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: PERSONAL_CAT, allowance: null }) as never);
  const res = await POST(req({ ...base, category_id: 'cat-p', allowance_id: 'nope' }));
  expect(res.status).toBe(400);
});

it('rejects tagging an INCOME transaction to the allowance (400)', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: { ...PERSONAL_CAT, type: 'income' } }) as never);
  const res = await POST(req({ ...base, type: 'income', category_id: 'cat-p', allowance_id: 'allw-1' }));
  expect(res.status).toBe(400);
});

it('a normal personal expense without a tag has null allowance_id', async () => {
  mockCreateClient.mockResolvedValue(makeClient({ category: PERSONAL_CAT }) as never);
  const res = await POST(req({ ...base, category_id: 'cat-p' }));
  expect(res.status).toBe(201);
  expect(insertArg?.allowance_id).toBeNull();
});
