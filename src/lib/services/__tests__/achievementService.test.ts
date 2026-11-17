/**
 * achievementService tests — Story 15.3
 * Mocked Supabase (service boundary); owner-only RLS (036) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 *
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled chain here was a
 * miniature of that factory — a fixed method list plus a `then`, which is the
 * better end of the hand-rolled range and still answers only the four methods
 * the service happened to call on the day it was written.
 *
 * CONTROL-ARM FILE: `achievementService.ts` has no swallowing catch, so a
 * missing chain method would surface as a failure rather than be absorbed.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
// Without this mock the REAL gate runs inside unlockAchievements (15-5 review:
// createServiceRoleClient is unmocked → the gate throws and swallows —
// the batch push silently no-oped in this suite)
jest.mock('@/lib/services/pushService', () => ({
  dispatchCategorizedPush: jest.fn().mockResolvedValue('sent'),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { createClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { getUnlocked, unlockAchievements } from '@/lib/services/achievementService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGate = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;

const TABLE = 'user_achievements';

function makeClient(result: { data: unknown; error: unknown }) {
  return createSupabaseMock({ tables: { [TABLE]: result as never } });
}

beforeEach(() => jest.clearAllMocks());

describe('getUnlocked', () => {
  it('returns unlock rows, user-scoped and ordered', async () => {
    const rows = [{ achievement_key: 'first_transaction', unlocked_at: '2026-07-01T00:00:00Z' }];
    const client = makeClient({ data: rows, error: null });
    mockCreateClient.mockResolvedValue(client.client as never);

    await expect(getUnlocked('u-1')).resolves.toEqual(rows);
    expect(client.callsTo(TABLE, 'eq')).toContainEqual(['user_id', 'u-1']);
    expect(client.callsTo(TABLE, 'order')).toContainEqual(['unlocked_at', { ascending: true }]);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ data: null, error: { message: 'boom' } }).client as never
    );
    await expect(getUnlocked('u-1')).rejects.toThrow('Failed to load achievements');
  });
});

describe('unlockAchievements', () => {
  it('returns [] for an empty key list without touching the db', async () => {
    await expect(unlockAchievements('u-1', [])).resolves.toEqual([]);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects garbage keys before touching the db', async () => {
    await expect(unlockAchievements('u-1', ['not_a_real_key' as never])).rejects.toThrow(
      'Invalid achievement key'
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('upserts idempotently and returns only inserted rows', async () => {
    const inserted = [{ achievement_key: 'week_streak', unlocked_at: '2026-07-13T10:00:00Z' }];
    const client = makeClient({ data: inserted, error: null });
    mockCreateClient.mockResolvedValue(client.client as never);

    const result = await unlockAchievements('u-1', ['week_streak']);
    expect(result).toEqual(inserted);
    // Idempotency contract: conflict target + ignoreDuplicates ride the UNIQUE constraint
    expect(client.callsTo(TABLE, 'upsert')).toContainEqual([
      [{ user_id: 'u-1', achievement_key: 'week_streak' }],
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true },
    ]);
  });

  it('a lost race (duplicate ignored) reports nothing new', async () => {
    const client = makeClient({ data: [], error: null });
    mockCreateClient.mockResolvedValue(client.client as never);
    await expect(unlockAchievements('u-1', ['first_transaction'])).resolves.toEqual([]);
  });

  it('throws a friendly error on db failure (never fabricates unlocks)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ data: null, error: { message: 'boom' } }).client as never
    );
    await expect(unlockAchievements('u-1', ['first_transaction'])).rejects.toThrow(
      'Failed to unlock achievements'
    );
    expect(mockGate).not.toHaveBeenCalled();
  });
});

describe('unlockAchievements — batch push (Story 15.5)', () => {
  it('pushes ONE milestone notification per inserted batch (singular body)', async () => {
    const inserted = [{ achievement_key: 'week_streak', unlocked_at: '2026-07-13T10:00:00Z' }];
    mockCreateClient.mockResolvedValue(makeClient({ data: inserted, error: null }).client as never);

    await unlockAchievements('u-1', ['week_streak']);

    expect(mockGate).toHaveBeenCalledTimes(1);
    expect(mockGate).toHaveBeenCalledWith('u-1', 'milestones', {
      type: 'achievement',
      title: 'Achievement unlocked!',
      body: 'You earned a new badge — see it in Settings.',
      data: { url: '/settings/personalization' },
    });
  });

  it('a multi-unlock batch still pushes exactly once, with a plural body', async () => {
    const inserted = [
      { achievement_key: 'week_streak', unlocked_at: '2026-07-13T10:00:00Z' },
      { achievement_key: 'month_streak', unlocked_at: '2026-07-13T10:00:00Z' },
    ];
    mockCreateClient.mockResolvedValue(makeClient({ data: inserted, error: null }).client as never);

    await unlockAchievements('u-1', ['week_streak', 'month_streak']);

    expect(mockGate).toHaveBeenCalledTimes(1);
    expect(mockGate).toHaveBeenCalledWith(
      'u-1',
      'milestones',
      expect.objectContaining({ body: 'You earned 2 new badges — see them in Settings.' })
    );
  });

  it('no push when nothing was actually inserted (lost race / duplicates)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({ data: [], error: null }).client as never);
    await unlockAchievements('u-1', ['first_transaction']);
    expect(mockGate).not.toHaveBeenCalled();
  });

  it('the push is awaited but cannot fail the unlock (gate never throws by contract)', async () => {
    // The gate resolves 'failed' instead of rejecting — unlock result unaffected
    mockGate.mockResolvedValueOnce('failed');
    const inserted = [{ achievement_key: 'week_streak', unlocked_at: '2026-07-13T10:00:00Z' }];
    mockCreateClient.mockResolvedValue(makeClient({ data: inserted, error: null }).client as never);

    await expect(unlockAchievements('u-1', ['week_streak'])).resolves.toEqual(inserted);
  });
});
