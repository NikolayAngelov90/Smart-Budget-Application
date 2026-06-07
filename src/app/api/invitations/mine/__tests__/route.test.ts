/**
 * /api/invitations/mine GET — Story 13.2 follow-up (in-app invite delivery)
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
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/invitationService', () => ({ listMyPendingInvitations: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { listMyPendingInvitations } from '@/lib/services/invitationService';
import { GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockList = listMyPendingInvitations as jest.MockedFunction<typeof listMyPendingInvitations>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}

beforeEach(() => jest.clearAllMocks());

it('401 when unauthenticated', async () => {
  mockCreateClient.mockResolvedValue(authClient(null) as never);
  expect((await GET()).status).toBe(401);
});

it('returns the caller’s pending invitations, keyed off their session email', async () => {
  mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'me@x.test' }) as never);
  mockList.mockResolvedValue([{ id: 'i1', token: 't1', householdName: 'Casa' }]);
  const res = await GET();
  expect(res.status).toBe(200);
  expect((await res.json()).data).toEqual([{ id: 'i1', token: 't1', householdName: 'Casa' }]);
  expect(mockList).toHaveBeenCalledWith('me@x.test');
});
