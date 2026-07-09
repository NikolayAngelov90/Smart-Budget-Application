/**
 * @jest-environment node
 *
 * POST /api/transactions — streak recording hook (Story 15.1)
 *
 * Streak recording is non-fatal enrichment (degradation policy): it runs for
 * ALL transaction types (income counts as logging) and its failure must never
 * fail the POST. The response carries `streak` like it carries `nudge`.
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
jest.mock('@/lib/services/pushService', () => ({ sendPushToUser: jest.fn(), isWithinQuietHours: jest.fn(() => false) }));
jest.mock('@/lib/services/streakService', () => ({ recordLogActivity: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/transactions/route';
import { createClient } from '@/lib/supabase/server';
import { recordLogActivity } from '@/lib/services/streakService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRecordLogActivity = recordLogActivity as jest.MockedFunction<typeof recordLogActivity>;

const EXPENSE_CAT = { id: 'cat-e', name: 'Snacks', color: '#111111', type: 'expense', household_id: null };
const INCOME_CAT = { id: 'cat-i', name: 'Salary', color: '#222222', type: 'income', household_id: null };

const STREAK_STATE = {
  current_streak: 4,
  longest_streak: 5,
  weekly_streak: 2,
  last_log_date: '2026-07-02',
  last_log_week: '2026-W27',
  freeze_used_on: null,
};

function makeClient(category: object) {
  const universal = (table: string) => {
    const q: Record<string, jest.Mock> = {};
    for (const m of ['select', 'eq', 'gte', 'lt', 'is', 'order', 'limit', 'not', 'insert']) {
      q[m] = jest.fn(() => q);
    }
    q.single = jest.fn().mockResolvedValue(
      table === 'categories'
        ? { data: category, error: null }
        : table === 'transactions'
          ? { data: { id: 'tx-new' }, error: null }
          : { data: { preferences: {} }, error: null }
    );
    q.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null });
    return q;
  };
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    from: jest.fn((t: string) => universal(t)),
  };
}

const req = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordLogActivity.mockResolvedValue({ state: STREAK_STATE, event: 'extended' });
});

it('records logging activity for an INCOME transaction and returns the streak', async () => {
  mockCreateClient.mockResolvedValue(makeClient(INCOME_CAT) as never);
  const res = await POST(req({ amount: 100, type: 'income', category_id: 'cat-i', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(mockRecordLogActivity).toHaveBeenCalledWith(
    'user-1',
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
  );
  expect(body.streak).toEqual(STREAK_STATE);
});

it('records logging activity for an expense transaction too', async () => {
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);
  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));

  expect(res.status).toBe(201);
  expect(mockRecordLogActivity).toHaveBeenCalledTimes(1);
});

it('streak failure is non-fatal: POST still 201 with streak null', async () => {
  mockRecordLogActivity.mockRejectedValue(new Error('streaks table missing'));
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.streak).toBeNull();
  expect(body.data).toBeDefined();
});
