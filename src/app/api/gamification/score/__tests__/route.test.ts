/**
 * @jest-environment node
 *
 * Budget Score API Route Tests — Story 15.2
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
 *
 * GET /api/gamification/score — chain mocks include EVERY chained method AND
 * record args so user-scoping can't silently vanish (14-4/15-1 lesson).
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

jest.mock('@/lib/services/streakService', () => ({
  getStreak: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak } from '@/lib/services/streakService';
import { isoWeekKey, localDayKey } from '@/lib/ai/streakEngine';
import { AVERAGE_WINDOW_MONTHS } from '@/lib/ai/spendingAnalysis';
import { toLocalISODate } from '@/lib/utils/date';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetStreak = getStreak as jest.MockedFunction<typeof getStreak>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  lt: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  upsert: jest.Mock;
}

function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'is', 'gte', 'lte', 'lt', 'or', 'order', 'upsert']) {
    bag[m] = jest.fn(() => q);
  }
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(result);
  return q;
}

type Result = { data: unknown; error: unknown };

/**
 * Queries arrive in Promise.all order per table:
 * transactions (current, historical), categories, category_budgets, goals.
 */
function makeSupabase(plan: Partial<Record<string, Result | Result[]>>, user: object | null = { id: 'user-1' }) {
  const queues: Record<string, Result[]> = {};
  for (const [k, v] of Object.entries(plan)) {
    queues[k] = Array.isArray(v) ? [...v] : [v as Result];
  }
  const chains: Record<string, ChainStub[]> = {};
  const from = jest.fn((table: string) => {
    const queue = queues[table];
    const result = queue && queue.length ? queue.shift()! : { data: [], error: null };
    const c = chain(result);
    (chains[table] ??= []).push(c);
    return c;
  });
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
    chains,
  };
}

// Internally consistent, clock-relative fixture — the route evaluates
// brokenness against the REAL today, and week keys must be valid ISO weeks
const NOW = new Date();
const STREAK = {
  current_streak: 30,
  longest_streak: 30,
  weekly_streak: 8,
  last_log_date: localDayKey(NOW),
  last_log_week: isoWeekKey(NOW),
  freeze_used_on: null,
};

// The exact date-window keys the route must query with (same construction)
const CURRENT_MONTH_START = toLocalISODate(new Date(NOW.getFullYear(), NOW.getMonth(), 1));
const CURRENT_MONTH_END = toLocalISODate(new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0));
const THREE_MONTHS_AGO = toLocalISODate(
  new Date(NOW.getFullYear(), NOW.getMonth() - AVERAGE_WINDOW_MONTHS, 1)
);

beforeEach(() => jest.clearAllMocks());

describe('GET /api/gamification/score', () => {
  it('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}, null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetStreak).not.toHaveBeenCalled();
  });

  it('computes a score with all inputs, user-scoped queries', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      goals: { data: [{ current_amount: 50, target_amount: 100 }], error: null },
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hasData).toBe(true);
    expect(body.budgetScore.score).toBeGreaterThan(0);
    expect(body.budgetScore.level).toBeDefined();
    expect(body.budgetScore.factors).toHaveLength(3);

    // Filter-arg assertions — user-scoping must not silently vanish
    for (const c of supabase.chains['transactions']!) {
      expect(c.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(c.eq).toHaveBeenCalledWith('type', 'expense');
    }
    // Date-window assertions — swapped/deleted month bounds must not pass
    const [currentChain, historicalChain] = supabase.chains['transactions']!;
    expect(currentChain!.gte).toHaveBeenCalledWith('date', CURRENT_MONTH_START);
    expect(currentChain!.lte).toHaveBeenCalledWith('date', CURRENT_MONTH_END);
    expect(historicalChain!.gte).toHaveBeenCalledWith('date', THREE_MONTHS_AGO);
    expect(historicalChain!.lt).toHaveBeenCalledWith('date', CURRENT_MONTH_START);
    expect(supabase.chains['categories']![0]!.eq).toHaveBeenCalledWith('user_id', 'user-1');
    const budgetsChain = supabase.chains['category_budgets']![0]!;
    expect(budgetsChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(budgetsChain.eq).toHaveBeenCalledWith('period', 'monthly');
    expect(budgetsChain.is).toHaveBeenCalledWith('household_id', null);
    const goalsChain = supabase.chains['goals']![0]!;
    expect(goalsChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    // 15-3 review: ALL own goals are fetched (achievements must see expired
    // goals - unlocks are once-ever); the score factor filters actives in code
    expect(goalsChain.or).not.toHaveBeenCalled();
    expect(mockGetStreak).toHaveBeenCalledWith('user-1');

    // Story 15.3: score-side achievement enrichment reports what was inserted
    expect(Array.isArray(body.newlyUnlocked)).toBe(true);
  });

  it('persists and reports score-side unlocks (upsert args asserted)', async () => {
    const inserted = [
      { achievement_key: 'first_budget', unlocked_at: '2026-07-13T10:00:00Z' },
      { achievement_key: 'first_goal', unlocked_at: '2026-07-13T10:00:00Z' },
      { achievement_key: 'score_steady', unlocked_at: '2026-07-13T10:00:00Z' },
      { achievement_key: 'score_master', unlocked_at: '2026-07-13T10:00:00Z' },
    ];
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      goals: { data: [{ current_amount: 50, target_amount: 100, deadline: null }], error: null },
      user_achievements: [
        { data: [], error: null }, // getUnlocked -> none yet
        { data: inserted, error: null }, // upsert returns inserted rows
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    // Full adherence + full consistency + half goals -> score 90 -> master:
    // earns first_budget + first_goal + score_steady + score_master (catalog order)
    expect(body.newlyUnlocked).toEqual([
      'first_budget',
      'first_goal',
      'score_steady',
      'score_master',
    ]);
    const upsertChain = supabase.chains['user_achievements']![1]!;
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      [
        { user_id: 'user-1', achievement_key: 'first_budget' },
        { user_id: 'user-1', achievement_key: 'first_goal' },
        { user_id: 'user-1', achievement_key: 'score_steady' },
        { user_id: 'user-1', achievement_key: 'score_master' },
      ],
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true }
    );
  });

  it('an EXPIRED reached goal still unlocks goal achievements but never scores the goals factor', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      goals: {
        data: [{ current_amount: 100, target_amount: 100, deadline: '2020-01-01' }],
        error: null,
      },
      user_achievements: [
        { data: [], error: null },
        {
          data: [
            { achievement_key: 'first_goal', unlocked_at: '2026-07-13T10:00:00Z' },
            { achievement_key: 'goal_reached', unlocked_at: '2026-07-13T10:00:00Z' },
          ],
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(body.newlyUnlocked).toEqual(expect.arrayContaining(['first_goal', 'goal_reached']));
    const goalsFactor = body.budgetScore.factors.find((f: { key: string }) => f.key === 'goals');
    expect(goalsFactor.status).toBe('unscored'); // expired -> not an active goal
  });

  it('achievement enrichment failure leaves the score intact (200, newlyUnlocked [])', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      user_achievements: { data: null, error: { message: 'boom' } }, // getUnlocked throws
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.budgetScore).not.toBeNull();
    expect(body.newlyUnlocked).toEqual([]);
  });

  it('returns hasData:false for a user with no activity at all', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase({}) as never);
    mockGetStreak.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ hasData: false, budgetScore: null, newlyUnlocked: [] });
  });

  it('500s when a CORE input fails (transactions) — never fabricate a score', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        transactions: { data: null, error: { message: 'boom' } },
      }) as never
    );
    mockGetStreak.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('degrades when category_budgets is unavailable (032 unapplied) — averages only', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [{ category_id: 'c1', amount: 300, date: '2026-06-10', type: 'expense' }], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: null, error: { message: 'relation does not exist' } },
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hasData).toBe(true); // historical average still yields adherence
  });

  it('degrades when the streaks table is unavailable (034 unapplied) — consistency UNSCORED, never punished', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      goals: { data: [{ current_amount: 100, target_amount: 100 }], error: null },
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockRejectedValue(new Error('Failed to load streak'));

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    const consistency = body.budgetScore.factors.find(
      (f: { key: string }) => f.key === 'consistency'
    );
    // Unknowable ≠ zero: an infra failure renormalizes away instead of
    // showing a false "hurting" 0/30 (degradation policy)
    expect(consistency.status).toBe('unscored');
    // Perfect adherence + full goals stay 100 despite the outage
    expect(body.budgetScore.score).toBe(100);
  });

  it('degrades when goals query fails — factor unscored, still 200', async () => {
    const supabase = makeSupabase({
      transactions: [
        { data: [{ category_id: 'c1', amount: 100, date: '2026-07-10', type: 'expense' }], error: null },
        { data: [], error: null },
      ],
      categories: { data: [{ id: 'c1', name: 'Food', type: 'expense' }], error: null },
      category_budgets: { data: [{ category_id: 'c1', limit_amount: 5000 }], error: null },
      goals: { data: null, error: { message: 'boom' } },
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetStreak.mockResolvedValue(STREAK);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    const goals = body.budgetScore.factors.find((f: { key: string }) => f.key === 'goals');
    expect(goals.status).toBe('unscored');
  });
});
