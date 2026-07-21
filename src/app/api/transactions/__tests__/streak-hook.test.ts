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
jest.mock('@/lib/services/pushService', () => ({ dispatchCategorizedPush: jest.fn().mockResolvedValue('sent') }));
jest.mock('@/lib/services/streakService', () => ({
  recordLogActivity: jest.fn(),
}));
jest.mock('@/lib/services/featureStateService', () => ({
  recordFeatureActivity: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/comebackService', () => ({
  getLatestChallenge: jest.fn().mockResolvedValue(null),
  createChallenge: jest.fn(),
  completeChallengeIfEarned: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/services/achievementService', () => ({
  getUnlocked: jest.fn().mockResolvedValue([]),
  unlockAchievements: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { POST } from '@/app/api/transactions/route';
import { createClient } from '@/lib/supabase/server';
import { evaluateNudge } from '@/lib/ai/nudgeEngine';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { recordLogActivity } from '@/lib/services/streakService';
import { recordFeatureActivity } from '@/lib/services/featureStateService';
import { getUnlocked, unlockAchievements } from '@/lib/services/achievementService';
import {
  completeChallengeIfEarned,
  createChallenge,
  getLatestChallenge,
} from '@/lib/services/comebackService';

const mockGetLatestChallenge = getLatestChallenge as jest.MockedFunction<typeof getLatestChallenge>;
const mockCreateChallenge = createChallenge as jest.MockedFunction<typeof createChallenge>;
const mockComplete = completeChallengeIfEarned as jest.MockedFunction<typeof completeChallengeIfEarned>;

const mockGetUnlocked = getUnlocked as jest.MockedFunction<typeof getUnlocked>;
const mockUnlockAchievements = unlockAchievements as jest.MockedFunction<typeof unlockAchievements>;

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRecordLogActivity = recordLogActivity as jest.MockedFunction<typeof recordLogActivity>;
const mockRecordFeatureActivity = recordFeatureActivity as jest.MockedFunction<typeof recordFeatureActivity>;

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
  mockGetLatestChallenge.mockResolvedValue(null);
  mockCreateChallenge.mockResolvedValue(null as never);
  mockComplete.mockResolvedValue(null);
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

it('records feature-disclosure activity with the SAME resolved day key (Story 15.7)', async () => {
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);
  await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));

  expect(mockRecordFeatureActivity).toHaveBeenCalledWith(
    'user-1',
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
  );
  // reuses the streak's day key — same first-call arg
  expect(mockRecordFeatureActivity.mock.calls[0]?.[1]).toBe(mockRecordLogActivity.mock.calls[0]?.[1]);
});

it('feature-activity failure is non-fatal: POST still 201', async () => {
  mockRecordFeatureActivity.mockRejectedValueOnce(new Error('feature_state table missing'));
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();
  expect(res.status).toBe(201);
  expect(body.data).toBeDefined();
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

it('completes the comeback challenge at target: service helper + Phoenix + envelope (Story 15.4)', async () => {
  mockGetLatestChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockComplete.mockResolvedValue({ completed: true, restoredStreak: 10 } as never);
  mockRecordLogActivity.mockResolvedValue({
    state: { ...STREAK_STATE, current_streak: 4 },
    event: 'extended',
    previous: STREAK_STATE,
  });
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(mockComplete).toHaveBeenCalledWith('user-1', ACTIVE_CHALLENGE, 4);
  expect(body.comeback).toEqual({ completed: true, restoredStreak: 10 });
  // Phoenix rides the existing achievements wiring
  expect(body.achievements).toContain('comeback');
});

it('below target: helper returns null, comeback null in envelope', async () => {
  mockGetLatestChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockComplete.mockResolvedValue(null);
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(body.comeback).toBeNull();
  expect(body.achievements).not.toContain('comeback');
});

it('comeback evaluation failure is non-fatal: POST still 201 with comeback null', async () => {
  mockGetLatestChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockComplete.mockRejectedValue(new Error('boom'));
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.comeback).toBeNull();
  expect(body.data).toBeDefined();
});

it('create-on-log: a returning user whose FIRST action is a log still gets the challenge (15-4 review)', async () => {
  // Pre-advance snapshot: 12-day streak, last log 10 days ago (stale row)
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const previous = { ...STREAK_STATE, current_streak: 12, last_log_date: daysAgo(10) };
  mockRecordLogActivity.mockResolvedValue({
    state: { ...STREAK_STATE, current_streak: 1, last_log_date: daysAgo(0) },
    event: 'reset',
    previous,
  });
  mockGetLatestChallenge.mockResolvedValue(null);
  mockCreateChallenge.mockResolvedValue(ACTIVE_CHALLENGE as never);
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: daysAgo(0) }));
  expect(res.status).toBe(201);
  // Snapshot captured from the PRE-advance state; window anchored at the tx
  expect(mockCreateChallenge).toHaveBeenCalledWith('user-1', 12, undefined);
  expect(mockComplete).toHaveBeenCalled(); // evaluated against the new challenge
});

it("nudge push goes THROUGH the gate with category 'nudges' (Story 15.5 review — was untested)", async () => {
  const mockEvaluateNudge = evaluateNudge as jest.MockedFunction<typeof evaluateNudge>;
  const mockGate = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;
  mockEvaluateNudge.mockReturnValueOnce({
    title: 'Heads up on Snacks',
    body: 'You are close to your usual monthly spend.',
  } as never);
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.nudge).toMatchObject({ title: 'Heads up on Snacks' });
  // The gate owns the 'nudges' toggle + quiet hours — the route must never
  // re-implement them (AC5); a stale mock here previously hid this wiring
  expect(mockGate).toHaveBeenCalledWith(
    'user-1',
    'nudges',
    expect.objectContaining({
      type: 'nudge',
      title: 'Heads up on Snacks',
      data: { url: '/dashboard' },
    })
  );
});

it('Phoenix repair: a previously-completed challenge re-derives the signal (self-healing badge)', async () => {
  mockGetLatestChallenge.mockResolvedValue({ ...ACTIVE_CHALLENGE, status: 'completed' } as never);
  mockComplete.mockResolvedValue(null); // nothing newly completed
  mockCreateClient.mockResolvedValue(makeClient(EXPENSE_CAT) as never);

  const res = await POST(req({ amount: 10, type: 'expense', category_id: 'cat-e', date: '2026-07-02' }));
  const body = await res.json();

  expect(res.status).toBe(201);
  expect(body.comeback).toBeNull(); // no new completion event
  expect(body.achievements).toContain('comeback'); // lost award repaired
});
