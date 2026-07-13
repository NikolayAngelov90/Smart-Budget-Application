/**
 * achievementService tests — Story 15.3
 * Mocked Supabase (service boundary); owner-only RLS (036) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import { getUnlocked, unlockAchievements } from '@/lib/services/achievementService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  upsert: jest.Mock;
}

function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'order', 'upsert']) {
    bag[m] = jest.fn(() => q);
  }
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(result);
  return q;
}

function makeClient(result: { data: unknown; error: unknown }) {
  const c = chain(result);
  return { from: jest.fn(() => c), chain: c };
}

beforeEach(() => jest.clearAllMocks());

describe('getUnlocked', () => {
  it('returns unlock rows, user-scoped and ordered', async () => {
    const rows = [{ achievement_key: 'first_transaction', unlocked_at: '2026-07-01T00:00:00Z' }];
    const client = makeClient({ data: rows, error: null });
    mockCreateClient.mockResolvedValue(client as never);

    await expect(getUnlocked('u-1')).resolves.toEqual(rows);
    expect(client.chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(client.chain.order).toHaveBeenCalledWith('unlocked_at', { ascending: true });
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ data: null, error: { message: 'boom' } }) as never);
    await expect(getUnlocked('u-1')).rejects.toThrow('Failed to load achievements');
  });
});

describe('unlockAchievements', () => {
  it('returns [] for an empty key list without touching the db', async () => {
    await expect(unlockAchievements('u-1', [])).resolves.toEqual([]);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects garbage keys before touching the db', async () => {
    await expect(
      unlockAchievements('u-1', ['not_a_real_key' as never])
    ).rejects.toThrow('Invalid achievement key');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('upserts idempotently and returns only inserted rows', async () => {
    const inserted = [{ achievement_key: 'week_streak', unlocked_at: '2026-07-13T10:00:00Z' }];
    const client = makeClient({ data: inserted, error: null });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await unlockAchievements('u-1', ['week_streak']);
    expect(result).toEqual(inserted);
    // Idempotency contract: conflict target + ignoreDuplicates ride the UNIQUE constraint
    expect(client.chain.upsert).toHaveBeenCalledWith(
      [{ user_id: 'u-1', achievement_key: 'week_streak' }],
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true }
    );
  });

  it('a lost race (duplicate ignored) reports nothing new', async () => {
    const client = makeClient({ data: [], error: null });
    mockCreateClient.mockResolvedValue(client as never);
    await expect(unlockAchievements('u-1', ['first_transaction'])).resolves.toEqual([]);
  });

  it('throws a friendly error on db failure (never fabricates unlocks)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ data: null, error: { message: 'boom' } }) as never);
    await expect(unlockAchievements('u-1', ['first_transaction'])).rejects.toThrow(
      'Failed to unlock achievements'
    );
  });
});
