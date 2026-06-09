/**
 * /api/households/members (GET) + /[userId] (DELETE) — Story 13.11
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
jest.mock('@/lib/services/householdMemberService', () => ({
  listHouseholdMembers: jest.fn(),
  removeMember: jest.fn(),
  CannotRemoveSelfError: class CannotRemoveSelfError extends Error {},
  MemberNotFoundError: class MemberNotFoundError extends Error {},
}));
jest.mock('@/lib/services/invitationService', () => ({
  NotHouseholdAdminError: class NotHouseholdAdminError extends Error {},
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import { listHouseholdMembers, removeMember, CannotRemoveSelfError, MemberNotFoundError } from '@/lib/services/householdMemberService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';
import { GET } from '../route';
import { DELETE } from '../[userId]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockList = listHouseholdMembers as jest.MockedFunction<typeof listHouseholdMembers>;
const mockRemove = removeMember as jest.MockedFunction<typeof removeMember>;

function authClient(user: object | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }) } };
}
const params = Promise.resolve({ userId: 'target' });

beforeEach(() => jest.clearAllMocks());

describe('GET /api/households/members', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });
  it('returns the roster', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockList.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});

describe('DELETE /api/households/members/[userId]', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await DELETE({} as never, { params })).status).toBe(401);
  });
  it('removes a member (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockResolvedValue(undefined);
    const res = await DELETE({} as never, { params });
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith('admin', 'target');
  });
  it('400 when removing self', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockRejectedValue(new CannotRemoveSelfError());
    expect((await DELETE({} as never, { params })).status).toBe(400);
  });
  it('403 when not an admin', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockRemove.mockRejectedValue(new NotHouseholdAdminError());
    expect((await DELETE({} as never, { params })).status).toBe(403);
  });
  it('404 when the target is not a member', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockRejectedValue(new MemberNotFoundError());
    expect((await DELETE({} as never, { params })).status).toBe(404);
  });
});
