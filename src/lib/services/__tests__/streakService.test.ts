/**
 * streakService tests — Story 15.1
 * Mocked Supabase (service boundary); owner-only RLS (034) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getStreak, recordLogActivity } from '@/lib/services/streakService';
import type { StreakState } from '@/types/database.types';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
}

function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'insert', 'update']) {
    bag[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>;

function makeClient(plan: Plan) {
  const queues: Record<string, { data: unknown; error: unknown }[] | { data: unknown; error: unknown }> = {};
  for (const [k, v] of Object.entries(plan)) queues[k] = Array.isArray(v) ? [...v] : v;
  const chains: ChainStub[] = [];
  const from = jest.fn((table: string) => {
    const q = queues[table];
    let result: { data: unknown; error: unknown } = { data: null, error: null };
    if (Array.isArray(q)) result = q.length ? q.shift()! : { data: null, error: null };
    else if (q) result = q;
    const c = chain(result);
    chains.push(c);
    return c;
  });
  return { from, chains };
}

const STATE: StreakState = {
  current_streak: 3,
  longest_streak: 5,
  weekly_streak: 2,
  last_log_date: '2026-01-06',
  last_log_week: '2026-W02',
  freeze_used_on: null,
};

beforeEach(() => jest.clearAllMocks());

describe('getStreak', () => {
  it('returns null before the first log', async () => {
    const client = makeClient({ streaks: { data: null, error: null } });
    mockCreateClient.mockResolvedValue(client as never);
    await expect(getStreak('u-1')).resolves.toBeNull();
    // user-scoped read
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('user_id', 'u-1');
  });

  it('returns the streak state row', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ streaks: { data: STATE, error: null } }) as never
    );
    await expect(getStreak('u-1')).resolves.toEqual(STATE);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ streaks: { data: null, error: { message: 'boom' } } }) as never
    );
    await expect(getStreak('u-1')).rejects.toThrow('Failed to load streak');
  });
});

describe('recordLogActivity', () => {
  it('inserts a fresh row on the first ever log', async () => {
    const client = makeClient({
      streaks: [
        { data: null, error: null }, // getStreak → none
        { data: null, error: null }, // insert ok
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await recordLogActivity('u-1', '2026-01-05');
    expect(result.event).toBe('started');
    expect(client.chains[1]!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', current_streak: 1, last_log_date: '2026-01-05' })
    );
  });

  it('updates the existing row on a consecutive day (user-scoped)', async () => {
    const client = makeClient({
      streaks: [
        { data: STATE, error: null }, // getStreak
        { data: null, error: null }, // update ok
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await recordLogActivity('u-1', '2026-01-07');
    expect(result.event).toBe('extended');
    expect(result.state.current_streak).toBe(4);
    const updateChain = client.chains[1]!;
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ current_streak: 4, last_log_date: '2026-01-07' })
    );
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u-1');
  });

  it('skips the write entirely for same-day repeats (idempotent)', async () => {
    const client = makeClient({ streaks: { data: STATE, error: null } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await recordLogActivity('u-1', '2026-01-06');
    expect(result.event).toBe('same_day');
    expect(client.from).toHaveBeenCalledTimes(1); // only the read
  });

  it('recovers from a 23505 first-log race by re-reading and updating', async () => {
    const client = makeClient({
      streaks: [
        { data: null, error: null }, // getStreak → none (stale)
        { data: null, error: { code: '23505', message: 'duplicate' } }, // insert loses race
        { data: STATE, error: null }, // re-read winner row
        { data: null, error: null }, // retry update ok
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await recordLogActivity('u-1', '2026-01-07');
    expect(result.event).toBe('extended');
    expect(result.state.current_streak).toBe(4);
  });

  it('propagates update failures so callers can treat them as non-fatal', async () => {
    const client = makeClient({
      streaks: [
        { data: STATE, error: null },
        { data: null, error: { message: 'boom' } },
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);
    await expect(recordLogActivity('u-1', '2026-01-07')).rejects.toThrow(
      'Failed to update streak'
    );
  });
});
