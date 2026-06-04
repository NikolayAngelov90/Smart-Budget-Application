/**
 * /api/invitations/accept route tests — Story 13.3
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
  acceptInvitation: jest.fn(),
  validateInvitation: jest.fn(),
  InvalidTokenError: class InvalidTokenError extends Error {},
  InvitationNotPendingError: class InvitationNotPendingError extends Error {},
  InvitationExpiredError: class InvitationExpiredError extends Error {},
  EmailMismatchError: class EmailMismatchError extends Error {},
  AlreadyInHouseholdError: class AlreadyInHouseholdError extends Error {},
}));

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient } from '@/lib/supabase/server';
import {
  acceptInvitation,
  validateInvitation,
  InvalidTokenError,
  InvitationNotPendingError,
  InvitationExpiredError,
  EmailMismatchError,
  AlreadyInHouseholdError,
} from '@/lib/services/invitationService';
import { POST, GET } from '../route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAccept = acceptInvitation as jest.MockedFunction<typeof acceptInvitation>;
const mockValidate = validateInvitation as jest.MockedFunction<typeof validateInvitation>;

const TOKEN = '550e8400-e29b-41d4-a716-446655440000'; // valid RFC-4122 v4 UUID
const HOUSEHOLD = { id: 'h-1', name: 'Home', created_by: 'a', created_at: 'x', updated_at: 'x' };

function authClient(user: object | null) {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: 'no user' } }) },
  };
}
function postReq(body: unknown) {
  return { json: async () => body } as never;
}
function getReq(token: string | null) {
  return { nextUrl: { searchParams: new URLSearchParams(token ? { token } : {}) } } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/invitations/accept', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await POST(postReq({ token: TOKEN }))).status).toBe(401);
  });

  it('400 on a non-uuid token', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    const res = await POST(postReq({ token: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('200 joins the household, passing the authed email', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    mockAccept.mockResolvedValue(HOUSEHOLD as never);
    const res = await POST(postReq({ token: TOKEN }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(HOUSEHOLD);
    expect(mockAccept).toHaveBeenCalledWith('u', 'a@x.com', TOKEN);
  });

  it.each([
    ['InvalidTokenError', () => new InvalidTokenError(), 404],
    ['InvitationNotPendingError', () => new InvitationNotPendingError(), 409],
    ['InvitationExpiredError', () => new InvitationExpiredError(), 410],
    ['EmailMismatchError', () => new EmailMismatchError(), 403],
    ['AlreadyInHouseholdError', () => new AlreadyInHouseholdError(), 409],
  ])('maps %s to %d', async (_name, make, status) => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    mockAccept.mockRejectedValue(make());
    expect((await POST(postReq({ token: TOKEN }))).status).toBe(status);
  });

  it('500 on an unexpected error', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    mockAccept.mockRejectedValue(new Error('boom'));
    expect((await POST(postReq({ token: TOKEN }))).status).toBe(500);
  });
});

describe('GET /api/invitations/accept', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET(getReq(TOKEN))).status).toBe(401);
  });

  it('returns invalid when no token is supplied', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    const res = await GET(getReq(null));
    expect((await res.json()).data).toEqual({ valid: false, reason: 'invalid' });
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('returns the validation result', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u', email: 'a@x.com' }) as never);
    mockValidate.mockResolvedValue({ valid: true, householdName: 'Home', invitedEmail: 'a@x.com', emailMatches: true } as never);
    const res = await GET(getReq(TOKEN));
    expect(res.status).toBe(200);
    expect((await res.json()).data.valid).toBe(true);
    expect(mockValidate).toHaveBeenCalledWith('u', 'a@x.com', TOKEN);
  });
});
