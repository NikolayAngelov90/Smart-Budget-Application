/**
 * comebackService tests — Story 15.4
 * Mocked Supabase (service boundary); owner-only RLS (037) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/services/streakService', () => ({
  restoreStreak: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { restoreStreak } from '@/lib/services/streakService';
import {
  completeChallengeIfEarned,
  countLogsSince,
  createChallenge,
  getActiveChallenge,
  getLatestChallenge,
  markStatus,
} from '@/lib/services/comebackService';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;
const mockRestoreStreak = restoreStreak as jest.MockedFunction<typeof restoreStreak>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled builder had ONE
 * queue for ALL tables, so a test could feed a challenge row to a transactions
 * count and never know. The factory keys results by table, which forces each
 * client to say what it answers: comeback_challenges, except countLogsSince's
 * count, which reads transactions.
 *
 * CONTROL-ARM FILE: comebackService has no catch at all. Missed by the
 * original census (`const from = jest.fn(`, not `from: jest.fn(`).
 */
type Result = { data: unknown; error: unknown; count?: number | null };

function makeClient(results: Result[], table = 'comeback_challenges') {
  return createSupabaseMock({ tables: { [table]: results } });
}

// CLOCK-RELATIVE (15-1 lesson): completion checks expiry against the real
// Date.now() — the original hardcoded expires_at (2026-07-20) rotted the day
// the calendar passed it and the "restores BEFORE marking" tests went red.
const ROW = {
  id: 'ch-1',
  started_at: new Date(Date.now() - 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  target_count: 3,
  previous_streak: 12,
  status: 'active',
  completed_at: null,
};

beforeEach(() => jest.clearAllMocks());

describe('getLatestChallenge / getActiveChallenge', () => {
  it('returns the newest challenge, user-scoped and ordered', async () => {
    const db = makeClient([{ data: ROW, error: null }]);
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(getLatestChallenge('u-1')).resolves.toEqual(ROW);
    expect(db.chainFor('comeback_challenges').eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(db.chainFor('comeback_challenges').order).toHaveBeenCalledWith('started_at', {
      ascending: false,
    });
    expect(db.chainFor('comeback_challenges').limit).toHaveBeenCalledWith(1);
  });

  it('getActiveChallenge filters status=active', async () => {
    const db = makeClient([{ data: null, error: null }]);
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(getActiveChallenge('u-1')).resolves.toBeNull();
    expect(db.chainFor('comeback_challenges').eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient([{ data: null, error: { message: 'boom' } }]).client as never
    );
    await expect(getLatestChallenge('u-1')).rejects.toThrow('Failed to load comeback challenge');
  });
});

describe('createChallenge (SERVICE-ROLE write — 15-4 review HIGH)', () => {
  it('inserts an active challenge with target and snapshot via the service-role client', async () => {
    const db = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(db.client as never);

    const result = await createChallenge('u-1', 12);
    expect(result).toEqual(ROW);
    expect(mockServiceClient).toHaveBeenCalled();
    expect(db.chainFor('comeback_challenges').insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', target_count: 3, previous_streak: 12 })
    );
  });

  it('anchors started_at when provided (create-on-log path counts the trigger tx)', async () => {
    const db = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(db.client as never);

    await createChallenge('u-1', 12, '2026-07-14T08:00:00.000Z');
    expect(db.chainFor('comeback_challenges').insert).toHaveBeenCalledWith(
      expect.objectContaining({ started_at: '2026-07-14T08:00:00.000Z' })
    );
  });

  it('23505 (lost create race) re-reads the winner instead of fabricating', async () => {
    const writeDb = makeClient([{ data: null, error: { code: '23505', message: 'duplicate' } }]);
    const readDb = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(writeDb.client as never);
    mockCreateClient.mockResolvedValue(readDb.client as never);

    await expect(createChallenge('u-1', 12)).resolves.toEqual(ROW);
  });
});

describe('markStatus (SERVICE-ROLE, status-guarded)', () => {
  it('guards the transition on status=active and reports the win', async () => {
    const db = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockServiceClient.mockReturnValue(db.client as never);

    await expect(markStatus('u-1', 'ch-1', 'completed')).resolves.toBe(true);
    expect(db.chainFor('comeback_challenges').update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completed_at: expect.any(String) })
    );
    expect(db.chainFor('comeback_challenges').eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(db.chainFor('comeback_challenges').eq).toHaveBeenCalledWith('id', 'ch-1');
    // Terminal states never clobber each other (15-4 review)
    expect(db.chainFor('comeback_challenges').eq).toHaveBeenCalledWith('status', 'active');
  });

  it('a lost transition race reports false (no clobber)', async () => {
    const db = makeClient([{ data: [], error: null }]);
    mockServiceClient.mockReturnValue(db.client as never);

    await expect(markStatus('u-1', 'ch-1', 'expired')).resolves.toBe(false);
  });

  it('dismiss does not stamp completed_at', async () => {
    const db = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockServiceClient.mockReturnValue(db.client as never);

    await markStatus('u-1', 'ch-1', 'dismissed');
    expect(db.chainFor('comeback_challenges').update).toHaveBeenCalledWith({ status: 'dismissed' });
  });
});

describe('completeChallengeIfEarned (restore-FIRST — 15-4 review MED)', () => {
  const activeRow = { ...ROW };

  it('restores BEFORE marking completed and reports the restore', async () => {
    const countDb = makeClient([{ data: null, error: null, count: 3 }], 'transactions');
    const writeDb = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockCreateClient.mockResolvedValue(countDb.client as never);
    mockServiceClient.mockReturnValue(writeDb.client as never);
    const order: string[] = [];
    mockRestoreStreak.mockImplementation(async () => {
      order.push('restore');
      return 10;
    });

    const result = await completeChallengeIfEarned('u-1', activeRow as never, 4);
    expect(result).toEqual({ completed: true, restoredStreak: 10 });
    // engine math: min(12, floor(12*0.5) + 4) = 10
    expect(mockRestoreStreak).toHaveBeenCalledWith('u-1', 10);
    expect(order).toEqual(['restore']);
    expect(writeDb.chainFor('comeback_challenges').update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('a restore failure leaves the challenge ACTIVE (retryable, never consumed-no-reward)', async () => {
    const countDb = makeClient([{ data: null, error: null, count: 3 }], 'transactions');
    const writeDb = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockCreateClient.mockResolvedValue(countDb.client as never);
    mockServiceClient.mockReturnValue(writeDb.client as never);
    mockRestoreStreak.mockRejectedValue(new Error('streaks blip'));

    await expect(completeChallengeIfEarned('u-1', activeRow as never, 4)).rejects.toThrow();
    expect(writeDb.from).not.toHaveBeenCalled(); // markStatus never ran
  });

  it('below target / non-active / expired → null without writes', async () => {
    const countDb = makeClient([{ data: null, error: null, count: 2 }], 'transactions');
    mockCreateClient.mockResolvedValue(countDb.client as never);
    await expect(completeChallengeIfEarned('u-1', activeRow as never, 4)).resolves.toBeNull();

    await expect(
      completeChallengeIfEarned('u-1', { ...activeRow, status: 'dismissed' } as never, 4)
    ).resolves.toBeNull();
    await expect(
      completeChallengeIfEarned(
        'u-1',
        { ...activeRow, expires_at: new Date(Date.now() - 1000).toISOString() } as never,
        4
      )
    ).resolves.toBeNull();
    expect(mockRestoreStreak).not.toHaveBeenCalled();
  });
});

describe('countLogsSince', () => {
  it('counts by server-set created_at, NOT the user-editable date field', async () => {
    const db = makeClient([{ data: null, error: null, count: 2 }], 'transactions');
    mockCreateClient.mockResolvedValue(db.client as never);

    await expect(countLogsSince('u-1', '2026-07-13T08:00:00Z')).resolves.toBe(2);
    expect(db.chainFor('transactions').eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(db.chainFor('transactions').gte).toHaveBeenCalledWith(
      'created_at',
      '2026-07-13T08:00:00Z'
    );
  });
});
