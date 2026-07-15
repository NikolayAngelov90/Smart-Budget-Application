/**
 * comebackService tests — Story 15.4
 * Mocked Supabase (service boundary); owner-only RLS (037) is the prod gate.
 * Chain mocks record args so user-scoping can't silently vanish (14-4 lesson).
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  countLogsSince,
  createChallenge,
  getActiveChallenge,
  getLatestChallenge,
  markStatus,
} from '@/lib/services/comebackService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

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

describe('createChallenge', () => {
  it('inserts an active challenge with target and snapshot', async () => {
    const client = makeClient([{ data: ROW, error: null }]);
    mockCreateClient.mockResolvedValue(client as never);

    const result = await createChallenge('u-1', 12);
    expect(result).toEqual(ROW);
    expect(client.chains[0]!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', target_count: 3, previous_streak: 12 })
    );
  });

  it('23505 (lost create race) re-reads the winner instead of fabricating', async () => {
    const client = makeClient([
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: ROW, error: null }, // re-read active
    ]);
    mockCreateClient.mockResolvedValue(client as never);

    await expect(createChallenge('u-1', 12)).resolves.toEqual(ROW);
  });
});

describe('markStatus', () => {
  it('updates own row; completed stamps completed_at', async () => {
    const client = makeClient([{ data: null, error: null }]);
    mockCreateClient.mockResolvedValue(client as never);

    await markStatus('u-1', 'ch-1', 'completed');
    expect(client.chains[0]!.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completed_at: expect.any(String) })
    );
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(client.chains[0]!.eq).toHaveBeenCalledWith('id', 'ch-1');
  });

  it('dismiss does not stamp completed_at', async () => {
    const client = makeClient([{ data: null, error: null }]);
    mockCreateClient.mockResolvedValue(client as never);

    await markStatus('u-1', 'ch-1', 'dismissed');
    expect(client.chains[0]!.update).toHaveBeenCalledWith({ status: 'dismissed' });
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
