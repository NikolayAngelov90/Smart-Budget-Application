/**
 * @jest-environment node
 *
 * Re-engagement Push Cron Tests — Story 15.5
 * (pragma must live in the FIRST docblock — Jest ignores later ones)
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
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/pushService', () => ({
  dispatchCategorizedPush: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { localDayKey } from '@/lib/ai/streakEngine';
import { GET } from '../route';

const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockDispatch = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;

function makeClient(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'limit']) q[m] = jest.fn(() => q);
  (q as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { from: jest.fn(() => q), chain: q };
}

const req = (auth?: string) =>
  ({ headers: { get: () => auth ?? null } }) as never;

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...OLD_ENV, CRON_SECRET: 'shhh-secret-42' };
  mockDispatch.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe('GET /api/cron/reengagement-push', () => {
  it('401s without the cron secret', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('pushes exactly the day-7 users through the gate (opt-in enforced there)', async () => {
    const client = makeClient({
      data: [{ user_id: 'u-1' }, { user_id: 'u-2' }],
      error: null,
    });
    mockServiceClient.mockReturnValue(client as never);

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, usersFound: 2, dispatched: 2, errors: 0 });
    // Scans for last_log_date EXACTLY 7 days ago — >= would push daily forever
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    expect(client.chain.eq).toHaveBeenCalledWith('last_log_date', localDayKey(sevenAgo));
    expect(mockDispatch).toHaveBeenCalledWith(
      'u-1',
      'reengagement',
      expect.objectContaining({ type: 'comeback', data: { url: '/dashboard' } })
    );
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it('per-user failures never abort the batch', async () => {
    const client = makeClient({
      data: [{ user_id: 'u-1' }, { user_id: 'u-2' }],
      error: null,
    });
    mockServiceClient.mockReturnValue(client as never);
    mockDispatch
      .mockRejectedValueOnce(new Error('endpoint gone'))
      .mockResolvedValueOnce(undefined);

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.errors).toBe(1);
  });

  it('500s when the streaks scan fails (never silently succeeds)', async () => {
    mockServiceClient.mockReturnValue(makeClient({ data: null, error: { message: 'boom' } }) as never);
    const res = await GET(req('Bearer shhh-secret-42'));
    expect(res.status).toBe(500);
  });
});
