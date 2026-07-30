/**
 * @jest-environment node
 */

/**
 * Shared-goal achievements — DW-6 (decided in DW-5 #2).
 *
 * `/api/gamification/score` scoped goals with `.eq(user_id)`, so a household
 * member who helped reach a SHARED goal they did not create kept `first_goal`
 * and `goal_reached` locked permanently — the goal is already complete, so no
 * later event could ever unlock them.
 *
 * The widening has to be precise. Two properties are load-bearing:
 *
 *  - participation comes from `goal_contributions`, NEVER from household
 *    membership. Otherwise every member earns every shared goal's badge and the
 *    achievement stops meaning anything.
 *  - the SCORE stays personal. Story 15-2 scoped the score deliberately; only
 *    the achievement evaluation may see shared goals, and the number must not
 *    move.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/streakService', () => ({ getStreak: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak } from '@/lib/services/streakService';
import { isoWeekKey, localDayKey } from '@/lib/ai/streakEngine';
import { logger } from '@/lib/utils/logger';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetStreak = getStreak as jest.MockedFunction<typeof getStreak>;

interface Result {
  data: unknown[] | null;
  error: unknown;
}

interface ChainStub extends Record<string, jest.Mock> {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  not: jest.Mock;
}

function chain(result: Result): ChainStub {
  const c = {} as ChainStub;
  const thenable = Object.assign(Promise.resolve(result), c);
  // `upsert` matters: unlockAchievements upserts then selects, and a missing
  // method throws into the route's catch, silently yielding newlyUnlocked: [].
  const methods = [
    'select', 'eq', 'gte', 'lte', 'lt', 'gt', 'is', 'or', 'in', 'not', 'order',
    'upsert', 'insert', 'update', 'delete', 'single', 'maybeSingle',
  ];
  for (const m of methods) {
    c[m] = jest.fn(() => thenable);
  }
  Object.assign(thenable, c);
  return Object.assign(c, { __thenable: thenable }) as ChainStub;
}

/** Per-table queues; a table queried twice takes its results in order. */
function makeSupabase(plan: Partial<Record<string, Result | Result[]>>) {
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
    return (c as unknown as { __thenable: ChainStub }).__thenable;
  });
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from,
    chains,
  };
}

const NOW = new Date();
const STREAK = {
  current_streak: 30,
  longest_streak: 30,
  weekly_streak: 8,
  last_log_date: localDayKey(NOW),
  last_log_week: isoWeekKey(NOW),
  freeze_used_on: null,
};

const getRequest = () =>
  ({ url: 'http://localhost:3000/api/gamification/score' }) as never;

/** A reached goal created by SOMEONE ELSE, shared with this household. */
const SHARED_REACHED = {
  id: 'g-shared',
  user_id: 'user-2',
  household_id: 'hh-1',
  current_amount: 2000,
  target_amount: 2000,
  deadline: null,
};

const BASE = {
  transactions: [
    { data: [], error: null },
    { data: [], error: null },
  ],
  categories: { data: [], error: null },
  category_budgets: { data: [], error: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStreak.mockResolvedValue(STREAK);
});

describe('shared-goal achievements', () => {
  it('unlocks goal achievements for a contributor who did not create the goal', async () => {
    const supabase = makeSupabase({
      ...BASE,
      // 1st goals query = own goals (none). 2nd = the contributed shared goal.
      goals: [
        { data: [], error: null },
        { data: [SHARED_REACHED], error: null },
      ],
      goal_contributions: { data: [{ goal_id: 'g-shared' }], error: null },
      user_achievements: [
        { data: [], error: null },
        {
          data: [
            { achievement_key: 'first_goal', unlocked_at: '2026-07-30T10:00:00Z' },
            { achievement_key: 'goal_reached', unlocked_at: '2026-07-30T10:00:00Z' },
          ],
          error: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const body = await (await GET(getRequest())).json();

    expect(body.newlyUnlocked).toEqual(
      expect.arrayContaining(['first_goal', 'goal_reached'])
    );
  });

  it('unlocks nothing for a member who never contributed', async () => {
    const supabase = makeSupabase({
      ...BASE,
      goals: [
        { data: [], error: null },
        { data: [], error: null },
      ],
      // No contributions → not a participant, however shared the goal is.
      goal_contributions: { data: [], error: null },
      user_achievements: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const body = await (await GET(getRequest())).json();

    expect(body.newlyUnlocked).toEqual([]);
    // With no contributions there is nothing to look up — the second goals
    // query must be skipped entirely.
    expect(supabase.chains['goals']?.length ?? 0).toBe(1);
  });

  it('never widens to another member PERSONAL goals', async () => {
    const supabase = makeSupabase({
      ...BASE,
      goals: [
        { data: [], error: null },
        { data: [], error: null },
      ],
      goal_contributions: { data: [{ goal_id: 'g-shared' }], error: null },
      user_achievements: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    await GET(getRequest());

    const sharedQuery = supabase.chains['goals']![1]!;
    // Restricted to the contributed ids AND to shared goals only. Without the
    // household_id filter a contribution to someone's PERSONAL goal would pull
    // that private goal into a gamification response.
    expect(sharedQuery.in).toHaveBeenCalledWith('id', ['g-shared']);
    expect(sharedQuery.not).toHaveBeenCalledWith('household_id', 'is', null);
  });

  it('scopes contributions to the caller, not the household', async () => {
    const supabase = makeSupabase({
      ...BASE,
      goals: [
        { data: [], error: null },
        { data: [], error: null },
      ],
      goal_contributions: { data: [{ goal_id: 'g-shared' }], error: null },
      user_achievements: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    await GET(getRequest());

    expect(supabase.chains['goal_contributions']![0]!.eq).toHaveBeenCalledWith(
      'user_id',
      'user-1'
    );
  });

  it('leaves the SCORE personal — a shared goal does not move the goals factor', async () => {
    // Story 15-2 scoped the score deliberately. DW-6 widens achievements only.
    const supabase = makeSupabase({
      ...BASE,
      goals: [
        { data: [], error: null }, // no OWN goals
        { data: [SHARED_REACHED], error: null },
      ],
      goal_contributions: { data: [{ goal_id: 'g-shared' }], error: null },
      user_achievements: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const body = await (await GET(getRequest())).json();

    const goalsFactor = body.budgetScore?.factors?.find(
      (f: { key: string }) => f.key === 'goals'
    );
    // No OWN active goals → the factor stays unscored despite the shared one.
    expect(goalsFactor?.status).toBe('unscored');
  });

  it('degrades to own goals when the contributions lookup fails', async () => {
    const supabase = makeSupabase({
      ...BASE,
      goals: [{ data: [], error: null }],
      goal_contributions: { data: null, error: { message: 'boom' } },
      user_achievements: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const res = await GET(getRequest());

    // Enrichment failure warns; it never 500s the score.
    expect(res.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith(
      'BudgetScoreAPI',
      expect.stringContaining('Shared-goal contributions unavailable'),
      expect.anything()
    );
  });

  it('counts a shared goal the user both created and contributed to only once', async () => {
    const own = { ...SHARED_REACHED, user_id: 'user-1' };
    const supabase = makeSupabase({
      ...BASE,
      goals: [
        { data: [own], error: null },
        { data: [own], error: null }, // same row via the contributed path
      ],
      goal_contributions: { data: [{ goal_id: 'g-shared' }], error: null },
      user_achievements: [
        { data: [], error: null },
        { data: [{ achievement_key: 'goal_reached', unlocked_at: 'x' }], error: null },
      ],
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const body = await (await GET(getRequest())).json();

    // Deduped by id — one unlock, not a duplicate.
    expect(body.newlyUnlocked.filter((k: string) => k === 'goal_reached')).toHaveLength(1);
  });
});
