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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockRestoreStreak = restoreStreak as jest.MockedFunction<typeof restoreStreak>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  gte: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
}

type Result = { data: unknown; error: unknown; count?: number | null };

function chain(result: Result): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'insert', 'update']) {
    bag[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(result);
  return q;
}

function makeClient(results: Result[]) {
  const queue = [...results];
  const chains: ChainStub[] = [];
  const from = jest.fn(() => {
    const c = chain(queue.length ? queue.shift()! : { data: null, error: null });
    chains.push(c);
    return c;
  });
  return { from, chains };
}

const ROW = {
  id: 'ch-1',
  started_at: '2026-07-13T08:00:00Z',
  expires_at: '2026-07-20T08:00:00Z',
  target_count: 3,
  previous_streak: 12,
  status: 'active',
  completed_at: null,
};

beforeEach(() => jest.clearAllMocks());

describe('getLatestChallenge / getActiveChallenge', () => {
  it('returns the newest challenge, user-scoped and ordered', async () => {
    const client = makeClient([{ data: ROW, error: null }]);
    mockCreateClient.mockResolvedValue(client as never);

    await expect(getLatestChallenge('u-1')).resolves.toEqual(ROW);
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(client.chains[0]!.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(client.chains[0]!.limit).toHaveBeenCalledWith(1);
  });

  it('getActiveChallenge filters status=active', async () => {
    const client = makeClient([{ data: null, error: null }]);
    mockCreateClient.mockResolvedValue(client as never);

    await expect(getActiveChallenge('u-1')).resolves.toBeNull();
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient([{ data: null, error: { message: 'boom' } }]) as never
    );
    await expect(getLatestChallenge('u-1')).rejects.toThrow('Failed to load comeback challenge');
  });
});

describe('createChallenge (SERVICE-ROLE write — 15-4 review HIGH)', () => {
  it('inserts an active challenge with target and snapshot via the service-role client', async () => {
    const client = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    const result = await createChallenge('u-1', 12);
    expect(result).toEqual(ROW);
    expect(mockServiceClient).toHaveBeenCalled();
    expect(client.chains[0]!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', target_count: 3, previous_streak: 12 })
    );
  });

  it('anchors started_at when provided (create-on-log path counts the trigger tx)', async () => {
    const client = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    await createChallenge('u-1', 12, '2026-07-14T08:00:00.000Z');
    expect(client.chains[0]!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ started_at: '2026-07-14T08:00:00.000Z' })
    );
  });

  it('23505 (lost create race) re-reads the winner instead of fabricating', async () => {
    const writeClient = makeClient([
      { data: null, error: { code: '23505', message: 'duplicate' } },
    ]);
    const readClient = makeClient([{ data: ROW, error: null }]);
    mockServiceClient.mockReturnValue(writeClient as never);
    mockCreateClient.mockResolvedValue(readClient as never);

    await expect(createChallenge('u-1', 12)).resolves.toEqual(ROW);
  });
});

describe('markStatus (SERVICE-ROLE, status-guarded)', () => {
  it('guards the transition on status=active and reports the win', async () => {
    const client = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    await expect(markStatus('u-1', 'ch-1', 'completed')).resolves.toBe(true);
    expect(client.chains[0]!.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completed_at: expect.any(String) })
    );
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('id', 'ch-1');
    // Terminal states never clobber each other (15-4 review)
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('a lost transition race reports false (no clobber)', async () => {
    const client = makeClient([{ data: [], error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    await expect(markStatus('u-1', 'ch-1', 'expired')).resolves.toBe(false);
  });

  it('dismiss does not stamp completed_at', async () => {
    const client = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    await markStatus('u-1', 'ch-1', 'dismissed');
    expect(client.chains[0]!.update).toHaveBeenCalledWith({ status: 'dismissed' });
  });
});

describe('completeChallengeIfEarned (restore-FIRST — 15-4 review MED)', () => {
  const activeRow = { ...ROW };

  it('restores BEFORE marking completed and reports the restore', async () => {
    const countClient = makeClient([{ data: null, error: null, count: 3 }]);
    const writeClient = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockCreateClient.mockResolvedValue(countClient as never);
    mockServiceClient.mockReturnValue(writeClient as never);
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
    expect(writeClient.chains[0]!.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('a restore failure leaves the challenge ACTIVE (retryable, never consumed-no-reward)', async () => {
    const countClient = makeClient([{ data: null, error: null, count: 3 }]);
    const writeClient = makeClient([{ data: [{ id: 'ch-1' }], error: null }]);
    mockCreateClient.mockResolvedValue(countClient as never);
    mockServiceClient.mockReturnValue(writeClient as never);
    mockRestoreStreak.mockRejectedValue(new Error('streaks blip'));

    await expect(completeChallengeIfEarned('u-1', activeRow as never, 4)).rejects.toThrow();
    expect(writeClient.chains).toHaveLength(0); // markStatus never ran
  });

  it('below target / non-active / expired → null without writes', async () => {
    const countClient = makeClient([{ data: null, error: null, count: 2 }]);
    mockCreateClient.mockResolvedValue(countClient as never);
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
    const client = makeClient([{ data: null, error: null, count: 2 }]);
    mockCreateClient.mockResolvedValue(client as never);

    await expect(countLogsSince('u-1', '2026-07-13T08:00:00Z')).resolves.toBe(2);
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(client.chains[0]!.gte).toHaveBeenCalledWith('created_at', '2026-07-13T08:00:00Z');
  });
});
