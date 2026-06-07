/**
 * /api/push/test POST — test notification delivery
 */

/**
 * @jest-environment node
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceRoleClient: jest.fn() }));
jest.mock('@/lib/services/pushService', () => ({ sendPushToUser: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/services/pushService';
import { POST } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockPush = sendPushToUser as jest.MockedFunction<typeof sendPushToUser>;

const ORIGINAL_ENV = process.env;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
function countClient(count: number) {
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count, error: null }),
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, VAPID_PRIVATE_KEY: 'priv', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub' };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(authClient(null) as never);
  expect((await POST()).status).toBe(401);
});

it('503 when VAPID is not configured', async () => {
  delete process.env.VAPID_PRIVATE_KEY;
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  expect((await POST()).status).toBe(503);
});

it('returns sent:0 and does not push when the user has no subscribed devices', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockServiceClient.mockReturnValue(countClient(0) as never);
  const res = await POST();
  expect(res.status).toBe(200);
  expect((await res.json()).data.sent).toBe(0);
  expect(mockPush).not.toHaveBeenCalled();
});

it('sends a test push to each subscribed device', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
  mockServiceClient.mockReturnValue(countClient(2) as never);
  const res = await POST();
  expect(res.status).toBe(200);
  expect((await res.json()).data.sent).toBe(2);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush.mock.calls[0]![2].type).toBe('test');
});
