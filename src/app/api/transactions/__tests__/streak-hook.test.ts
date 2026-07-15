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
jest.mock('@/lib/services/streakService', () => ({
  recordLogActivity: jest.fn(),
  restoreStreak: jest.fn(),
}));
jest.mock('@/lib/services/comebackService', () => ({
  getActiveChallenge: jest.fn().mockResolvedValue(null),
  countLogsSince: jest.fn(),
  markStatus: jest.fn(),
}));
jest.mock('@/lib/services/achievementService', () => ({
  getUnlocked: jest.fn().mockResolvedValue([]),
  unlockAchievements: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/transactions/route';
import { createClient } from '@/lib/supabase/server';
import { recordLogActivity } from '@/lib/services/streakService';
import { getUnlocked, unlockAchievements } from '@/lib/services/achievementService';
import { restoreStreak } from '@/lib/services/streakService';
import { countLogsSince, getActiveChallenge, markStatus } from '@/lib/services/comebackService';

const mockRestoreStreak = restoreStreak as jest.MockedFunction<typeof restoreStreak>;
const mockGetActiveChallenge = getActiveChallenge as jest.MockedFunction<typeof getActiveChallenge>;
const mockCountLogsSince = countLogsSince as jest.MockedFunction<typeof countLogsSince>;
const mockMarkStatus = markStatus as jest.MockedFunction<typeof markStatus>;

const mockGetUnlocked = getUnlocked as jest.MockedFunction<typeof getUnlocked>;
const mockUnlockAchievements = unlockAchievements as jest.MockedFunction<typeof unlockAchievements>;

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
  mockGetUnlocked.mockResolvedValue([]);
  mockUnlockAchievements.mockImplementation(async (_userId, keys) =>
    keys.map((achievement_key) => ({ achievement_key, unlocked_at: '2026-07-13T10:00:00Z' }))
  );
  mockGetActiveChallenge.mockResolvedValue(null);
});

const ACTIVE_CHALLENGE = {
  id: 'ch-1',
  started_at: new Date(Date.now() - 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  target_count: 3,
  previous_streak: 12,
  status: 'active' as const,
  completed_at: null,
};

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

it('returns newly unlocked achievements in the 201 envelope (Story 15.3)', async () => {
  // 7-day streak after this log → week_streak earned
  mockRecordLogActivity.mockResolvedValue({
    state: { ...STREAK_STATE, current_streak: 7 },
    event: 'extended',
  });
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.achievements).toEqual(['week_streak']);
  expect(mockUnlockAchievements).toHaveBeenCalledWith('user-1', ['week_streak']);
});

it('already-unlocked achievements are not re-reported', async () => {
  mockRecordLogActivity.mockResolvedValue({
    state: { ...STREAK_STATE, current_streak: 7 },
    event: 'extended',
  });
  mockGetUnlocked.mockResolvedValue([
    { achievement_key: 'week_streak', unlocked_at: '2026-07-01T00:00:00Z' },
  ] as never);
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(body.achievements).toEqual([]);
  expect(mockUnlockAchievements).not.toHaveBeenCalled();
});

it('achievement evaluation failure is non-fatal: POST still 201 with achievements []', async () => {
  mockGetUnlocked.mockRejectedValue(new Error('achievements table missing'));
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.achievements).toEqual([]);
  expect(body.data).toBeDefined();
});

it('completes the comeback challenge at target: restore + Phoenix + envelope (Story 15.4)', async () => {
  mockGetActiveChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockCountLogsSince.mockResolvedValue(3); // post-insert count reaches target
  mockRestoreStreak.mockResolvedValue(10); // floor(12/2)=6 + rebuilt 4 = 10
  mockRecordLogActivity.mockResolvedValue({
    state: { ...STREAK_STATE, current_streak: 4 },
    event: 'extended',
  });
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(mockMarkStatus).toHaveBeenCalledWith('user-1', 'ch-1', 'completed');
  // engine math: min(12, floor(12*0.5) + 4) = 10
  expect(mockRestoreStreak).toHaveBeenCalledWith('user-1', 10);
  expect(body.comeback).toEqual({ completed: true, restoredStreak: 10 });
  // Phoenix rides the existing achievements wiring
  expect(body.achievements).toContain('comeback');
});

it('below target: no completion, comeback null in envelope', async () => {
  mockGetActiveChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockCountLogsSince.mockResolvedValue(2);
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(body.comeback).toBeNull();
  expect(mockMarkStatus).not.toHaveBeenCalled();
  expect(mockRestoreStreak).not.toHaveBeenCalled();
});

it('comeback evaluation failure is non-fatal: POST still 201 with comeback null', async () => {
  mockGetActiveChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockCountLogsSince.mockRejectedValue(new Error('boom'));
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.comeback).toBeNull();
  expect(body.data).toBeDefined();
});
