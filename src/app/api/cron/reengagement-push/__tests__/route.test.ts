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
import { logger } from '@/lib/utils/logger';
import { GET } from '../route';

const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockDispatch = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;

// One thenable per .range() page — the route paginates until a short page
function makeClient(pages: Array<{ data: unknown; error: unknown }>) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'order']) q[m] = jest.fn(() => q);
  let call = 0;
  q.range = jest.fn(() => {
    const result = pages[Math.min(call, pages.length - 1)];
    call++;
    return Promise.resolve(result);
  });
  return { from: jest.fn(() => q), chain: q };
}

const req = (auth?: string) =>
  ({ headers: { get: () => auth ?? null } }) as never;

const OLD_ENV = process.env;

// Computed ONCE before any GET runs — recomputing at assertion time can
// disagree with the route's key when the test straddles midnight (review 15-5)
const sevenAgo = new Date();
sevenAgo.setDate(sevenAgo.getDate() - 7);
const expectedDayKey = localDayKey(sevenAgo);

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...OLD_ENV, CRON_SECRET: 'shhh-secret-42' };
  mockDispatch.mockResolvedValue('sent');
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
    const client = makeClient([
      { data: [{ user_id: 'u-1' }, { user_id: 'u-2' }], error: null },
    ]);
    mockServiceClient.mockReturnValue(client as never);

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, usersFound: 2, sent: 2, suppressed: 0, failed: 0 });
    // Scans for last_log_date EXACTLY 7 days ago — >= would push daily forever
    expect(client.chain.eq).toHaveBeenCalledWith('last_log_date', expectedDayKey);
    expect(mockDispatch).toHaveBeenCalledWith(
      'u-1',
      'reengagement',
      expect.objectContaining({ type: 'comeback', data: { url: '/dashboard' } })
    );
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  it('counts gate outcomes truthfully (the gate never throws — outcomes ARE the telemetry)', async () => {
    const client = makeClient([
      {
        data: [{ user_id: 'u-1' }, { user_id: 'u-2' }, { user_id: 'u-3' }],
        error: null,
      },
    ]);
    mockServiceClient.mockReturnValue(client as never);
    mockDispatch
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('suppressed') // opted out or quiet hours
      .mockResolvedValueOnce('failed'); // prefs unreadable / internal error

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, usersFound: 3, sent: 1, suppressed: 1, failed: 1 });
  });

  it('paginates past a full page instead of truncating the cohort', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({ user_id: `u-${i}` }));
    const client = makeClient([
      { data: fullPage, error: null },
      { data: [{ user_id: 'u-500' }], error: null },
    ]);
    mockServiceClient.mockReturnValue(client as never);

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.usersFound).toBe(501);
    expect(client.chain.range).toHaveBeenCalledTimes(2);
    expect(client.chain.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(client.chain.range).toHaveBeenNthCalledWith(2, 500, 999);
    expect(mockDispatch).toHaveBeenCalledTimes(501);
  });

  it('warns when the cohort hits the hard cap (remainder is permanently skipped)', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({ user_id: `u-${i}` }));
    // Every page full — the route stops at MAX_USERS (5000 = 10 pages)
    const client = makeClient([{ data: fullPage, error: null }]);
    mockServiceClient.mockReturnValue(client as never);

    const res = await GET(req('Bearer shhh-secret-42'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.usersFound).toBe(5000);
    expect(client.chain.range).toHaveBeenCalledTimes(10);
    expect(logger.warn).toHaveBeenCalledWith(
      'ReengagementPushCron',
      expect.stringContaining('cap')
    );
  });

  it('500s when the streaks scan fails (never silently succeeds)', async () => {
    mockServiceClient.mockReturnValue(
      makeClient([{ data: null, error: { message: 'boom' } }]) as never
    );
    const res = await GET(req('Bearer shhh-secret-42'));
    expect(res.status).toBe(500);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
