/**
 * /api/invitations route tests — Story 13.2
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

jest.mock('@/lib/services/invitationService', () => ({
  createInvitation: jest.fn(),
  listInvitations: jest.fn(),
  revokeInvitation: jest.fn(),
  NotHouseholdAdminError: class NotHouseholdAdminError extends Error {},
  InvitationExistsError: class InvitationExistsError extends Error {},
  InvitationNotFoundError: class InvitationNotFoundError extends Error {},
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  NotHouseholdAdminError,
  InvitationExistsError,
  InvitationNotFoundError,
} from '@/lib/services/invitationService';
import { POST, GET } from '../route';
import { DELETE } from '../[id]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreate = createInvitation as jest.MockedFunction<typeof createInvitation>;
const mockList = listInvitations as jest.MockedFunction<typeof listInvitations>;
const mockRevoke = revokeInvitation as jest.MockedFunction<typeof revokeInvitation>;

function authClient(user: object | null) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no user' } }) },
  };
}
function req(body: unknown) {
  return { json: async () => body, nextUrl: { origin: 'http://test' } } as never;
}
const INVITE = {
  id: 'inv-1', household_id: 'h-1', email: 'a@x.com', token: 'tok-1', status: 'pending',
  invited_by: 'user-1', expires_at: 'x', accepted_by: null, accepted_at: null, created_at: 'x',
};

beforeEach(() => jest.clearAllMocks());

describe('POST /api/invitations', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await POST(req({ email: 'a@x.com' }))).status).toBe(401);
  });

  it('400 on invalid email', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    const res = await POST(req({ email: 'bad' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('201 with invite + accept link', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockResolvedValue(INVITE as never);
    const res = await POST(req({ email: 'a@x.com' }));
    expect(res.status).toBe(201);
    const data = (await res.json()).data;
    expect(data.acceptLink).toContain('tok-1');
    expect(mockCreate).toHaveBeenCalledWith('user-1', 'a@x.com');
  });

  it('403 when not an admin', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockRejectedValue(new NotHouseholdAdminError());
    expect((await POST(req({ email: 'a@x.com' }))).status).toBe(403);
  });

  it('409 when an active invite exists', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockCreate.mockRejectedValue(new InvitationExistsError());
    expect((await POST(req({ email: 'a@x.com' }))).status).toBe(409);
  });
});

describe('GET /api/invitations', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET(req(null))).status).toBe(401);
  });

  it('200 with invitations (accept links added)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockList.mockResolvedValue([{ ...INVITE, isExpired: false }] as never);
    const res = await GET(req(null));
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data).toHaveLength(1);
    expect(data[0].acceptLink).toContain('tok-1');
  });

  it('403 for a non-admin', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockList.mockRejectedValue(new NotHouseholdAdminError());
    expect((await GET(req(null))).status).toBe(403);
  });
});

describe('DELETE /api/invitations/:id', () => {
  const params = Promise.resolve({ id: 'inv-1' });

  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await DELETE(req(null), { params })).status).toBe(401);
  });

  it('200 on revoke', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockRevoke.mockResolvedValue(undefined as never);
    const res = await DELETE(req(null), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).data.revoked).toBe(true);
  });

  it('404 when not found', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockRevoke.mockRejectedValue(new InvitationNotFoundError());
    expect((await DELETE(req(null), { params })).status).toBe(404);
  });

  it('403 when not an admin', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'user-1' }) as never);
    mockRevoke.mockRejectedValue(new NotHouseholdAdminError());
    expect((await DELETE(req(null), { params })).status).toBe(403);
  });
});
