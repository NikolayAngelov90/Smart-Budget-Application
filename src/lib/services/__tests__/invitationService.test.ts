/**
 * invitationService tests — Story 13.2 (mocked Supabase).
 * RLS isolation is covered by invitations.rls.test.ts, not here.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// invitationService imports pushService (web-push) — mock it so tests don't load native deps.
jest.mock('@/lib/services/pushService', () => ({ dispatchCategorizedPush: jest.fn() }));

import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import {
  createInvitation,
  listInvitations,
  listMyPendingInvitations,
  revokeInvitation,
  acceptInvitation,
  validateInvitation,
  NotHouseholdAdminError,
  InvitationExistsError,
  InvitationNotFoundError,
  InvalidTokenError,
  InvitationNotPendingError,
  InvitationExpiredError,
  EmailMismatchError,
  AlreadyInHouseholdError,
} from '@/lib/services/invitationService';

const mockPush = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;

const mockSrv = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;

const INVITE = {
  id: 'inv-1',
  household_id: 'h-1',
  email: 'a@x.com',
  token: 'tok-1',
  status: 'pending',
  invited_by: 'user-1',
  expires_at: new Date(Date.now() + 1_000_000_000).toISOString(),
  accepted_by: null,
  accepted_at: null,
  created_at: '2026-06-04T00:00:00Z',
};

interface AdminOpts {
  member?: object | null;
  memberErr?: object | null;
  precheck?: object | null; // existing pending invite for createInvitation
  insert?: { data: object | null; error: object | null };
  revokeLookup?: { data: object | null; error: object | null };
  thenResult?: { data?: unknown; error: object | null }; // list select / revoke update (awaited chain)
  inviteeId?: string | null; // user_id_by_email RPC result (Story 13.2 follow-up notify)
}

function makeAdmin(opts: AdminOpts = {}) {
  const {
    member = { household_id: 'h-1', role: 'admin' },
    memberErr = null,
    precheck = null,
    insert = { data: INVITE, error: null },
    revokeLookup,
    thenResult = { data: [INVITE], error: null },
    inviteeId = null,
  } = opts;

  const membersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: member, error: memberErr }),
  };
  const invChain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(
      revokeLookup !== undefined ? revokeLookup : { data: precheck, error: null }
    ),
    single: jest.fn().mockResolvedValue(insert),
    then: jest.fn((resolve: (v: unknown) => unknown) => Promise.resolve(thenResult).then(resolve)),
  };
  const from = jest.fn((t: string) => (t === 'household_members' ? membersChain : invChain));
  const rpc = jest.fn().mockResolvedValue({ data: inviteeId, error: null });
  return { client: { from, rpc }, membersChain, invChain, rpc };
}

beforeEach(() => jest.clearAllMocks());

describe('createInvitation', () => {
  it('creates a pending invite for an admin', async () => {
    const { client } = makeAdmin();
    mockSrv.mockReturnValue(client as never);
    const result = await createInvitation('user-1', '  A@X.com ');
    expect(result).toEqual(INVITE);
  });

  it('rejects an invalid email before any DB call', async () => {
    const { client } = makeAdmin();
    mockSrv.mockReturnValue(client as never);
    await expect(createInvitation('user-1', 'not-an-email')).rejects.toThrow(/valid email/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdAdminError when caller is not an admin', async () => {
    const { client } = makeAdmin({ member: { household_id: 'h-1', role: 'member' } });
    mockSrv.mockReturnValue(client as never);
    await expect(createInvitation('user-1', 'a@x.com')).rejects.toBeInstanceOf(NotHouseholdAdminError);
  });

  it('throws NotHouseholdAdminError when caller has no household', async () => {
    const { client } = makeAdmin({ member: null });
    mockSrv.mockReturnValue(client as never);
    await expect(createInvitation('user-1', 'a@x.com')).rejects.toBeInstanceOf(NotHouseholdAdminError);
  });

  it('throws InvitationExistsError when an active invite already exists (pre-check)', async () => {
    const { client } = makeAdmin({ precheck: { id: 'inv-existing' } });
    mockSrv.mockReturnValue(client as never);
    await expect(createInvitation('user-1', 'a@x.com')).rejects.toBeInstanceOf(InvitationExistsError);
  });

  it('maps a unique-violation (23505) on insert to InvitationExistsError', async () => {
    const { client } = makeAdmin({ insert: { data: null, error: { code: '23505', message: 'dup' } } });
    mockSrv.mockReturnValue(client as never);
    await expect(createInvitation('user-1', 'a@x.com')).rejects.toBeInstanceOf(InvitationExistsError);
  });

  it('pushes a notification when the invitee already has an account', async () => {
    const { client } = makeAdmin({ inviteeId: 'invitee-9' });
    mockSrv.mockReturnValue(client as never);
    await createInvitation('user-1', 'a@x.com');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]![0]).toBe('invitee-9'); // userId
    expect(mockPush.mock.calls[0]![1]).toBe('household'); // category gate (15.5)
  });

  it('does not push when the invitee email is not registered (and never fails the invite)', async () => {
    const { client } = makeAdmin({ inviteeId: null });
    mockSrv.mockReturnValue(client as never);
    const result = await createInvitation('user-1', 'a@x.com');
    expect(result).toEqual(INVITE);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('listMyPendingInvitations', () => {
  const future = new Date(Date.now() + 1_000_000_000).toISOString();
  const past = new Date(Date.now() - 1_000).toISOString();

  it('returns pending, non-expired invites for the email with the household name', async () => {
    const { client } = makeAdmin({
      thenResult: {
        data: [
          { id: 'i1', token: 't1', expires_at: future, households: { name: 'Casa' } },
          { id: 'i2', token: 't2', expires_at: past, households: { name: 'Old' } }, // expired → filtered
        ],
        error: null,
      },
    });
    mockSrv.mockReturnValue(client as never);
    const result = await listMyPendingInvitations('  A@X.com ');
    expect(result).toEqual([{ id: 'i1', token: 't1', householdName: 'Casa' }]);
  });

  it('returns [] for an empty email without a DB call', async () => {
    const { client } = makeAdmin();
    mockSrv.mockReturnValue(client as never);
    expect(await listMyPendingInvitations('')).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('listInvitations', () => {
  it('returns invitations with computed isExpired', async () => {
    const { client } = makeAdmin({ thenResult: { data: [INVITE], error: null } });
    mockSrv.mockReturnValue(client as never);
    const result = await listInvitations('user-1');
    expect(result).toHaveLength(1);
    expect(result[0]!.isExpired).toBe(false);
  });

  it('throws NotHouseholdAdminError for a non-admin', async () => {
    const { client } = makeAdmin({ member: { household_id: 'h-1', role: 'member' } });
    mockSrv.mockReturnValue(client as never);
    await expect(listInvitations('user-1')).rejects.toBeInstanceOf(NotHouseholdAdminError);
  });
});

describe('revokeInvitation', () => {
  it('revokes a pending invite in the admin household', async () => {
    const { client } = makeAdmin({
      revokeLookup: { data: { id: 'inv-1', status: 'pending' }, error: null },
      thenResult: { error: null },
    });
    mockSrv.mockReturnValue(client as never);
    await expect(revokeInvitation('user-1', 'inv-1')).resolves.toBeUndefined();
  });

  it('throws InvitationNotFoundError when not in the caller household', async () => {
    const { client } = makeAdmin({ revokeLookup: { data: null, error: null } });
    mockSrv.mockReturnValue(client as never);
    await expect(revokeInvitation('user-1', 'nope')).rejects.toBeInstanceOf(InvitationNotFoundError);
  });

  it('is idempotent for an already non-pending invite', async () => {
    const { client } = makeAdmin({ revokeLookup: { data: { id: 'inv-1', status: 'revoked' }, error: null } });
    mockSrv.mockReturnValue(client as never);
    await expect(revokeInvitation('user-1', 'inv-1')).resolves.toBeUndefined();
  });
});

// ============================================================================
// Story 13.3: accept / validate
// ============================================================================

const HOUSEHOLD = { id: 'h-1', name: 'Home', created_by: 'admin-1', created_at: 'x', updated_at: 'x' };

interface AcceptOpts {
  inv?: object | null;
  inHousehold?: boolean;
  memberErr?: { code?: string; message?: string } | null;
  flipErr?: object | null;
}

function makeAcceptAdmin(opts: AcceptOpts = {}) {
  const { inv = INVITE, inHousehold = false, memberErr = null, flipErr = null } = opts;
  const invChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: inv, error: null }),
    then: jest.fn((resolve: (v: unknown) => unknown) => Promise.resolve({ error: flipErr }).then(resolve)),
  };
  const membersChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: inHousehold ? { id: 'm' } : null, error: null }),
    insert: jest.fn().mockResolvedValue({ error: memberErr }),
  };
  const householdsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: HOUSEHOLD, error: null }),
  };
  const from = jest.fn((t: string) =>
    t === 'household_invitations' ? invChain : t === 'household_members' ? membersChain : householdsChain
  );
  return { client: { from } };
}

describe('acceptInvitation', () => {
  it('joins the household and returns it (admin notified best-effort)', async () => {
    const { client } = makeAcceptAdmin();
    mockSrv.mockReturnValue(client as never);
    const result = await acceptInvitation('user-2', 'A@x.com', 'tok-1');
    expect(result).toEqual(HOUSEHOLD);
    expect(mockPush).toHaveBeenCalledWith('user-1', 'household', expect.objectContaining({ type: 'household_event' }));
  });

  it('still joins when the best-effort push fails', async () => {
    const { client } = makeAcceptAdmin();
    mockSrv.mockReturnValue(client as never);
    mockPush.mockRejectedValueOnce(new Error('push down'));
    await expect(acceptInvitation('user-2', 'a@x.com', 'tok-1')).resolves.toEqual(HOUSEHOLD);
  });

  it('throws InvalidTokenError for an unknown token', async () => {
    const { client } = makeAcceptAdmin({ inv: null });
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'a@x.com', 'nope')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('throws InvitationNotPendingError for an already-used invite', async () => {
    const { client } = makeAcceptAdmin({ inv: { ...INVITE, status: 'accepted' } });
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'a@x.com', 'tok-1')).rejects.toBeInstanceOf(InvitationNotPendingError);
  });

  it('throws InvitationExpiredError for an expired invite', async () => {
    const { client } = makeAcceptAdmin({ inv: { ...INVITE, expires_at: new Date(Date.now() - 1000).toISOString() } });
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'a@x.com', 'tok-1')).rejects.toBeInstanceOf(InvitationExpiredError);
  });

  it('throws EmailMismatchError when the user email differs', async () => {
    const { client } = makeAcceptAdmin();
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'someone-else@x.com', 'tok-1')).rejects.toBeInstanceOf(EmailMismatchError);
  });

  it('throws AlreadyInHouseholdError when the caller already has a household', async () => {
    const { client } = makeAcceptAdmin({ inHousehold: true });
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'a@x.com', 'tok-1')).rejects.toBeInstanceOf(AlreadyInHouseholdError);
  });

  it('maps a membership unique-violation (23505) to AlreadyInHouseholdError', async () => {
    const { client } = makeAcceptAdmin({ memberErr: { code: '23505', message: 'dup' } });
    mockSrv.mockReturnValue(client as never);
    await expect(acceptInvitation('user-2', 'a@x.com', 'tok-1')).rejects.toBeInstanceOf(AlreadyInHouseholdError);
  });
});

describe('validateInvitation', () => {
  const invWithHousehold = { ...INVITE, households: { name: 'Home' } };

  it('reports valid for a pending, matching, non-expired invite', async () => {
    const { client } = makeAcceptAdmin({ inv: invWithHousehold });
    mockSrv.mockReturnValue(client as never);
    const result = await validateInvitation('user-2', 'a@x.com', 'tok-1');
    expect(result).toEqual({ valid: true, householdName: 'Home', invitedEmail: 'a@x.com', emailMatches: true });
  });

  it('reports invalid for an unknown token', async () => {
    const { client } = makeAcceptAdmin({ inv: null });
    mockSrv.mockReturnValue(client as never);
    expect(await validateInvitation('user-2', 'a@x.com', 'nope')).toEqual({ valid: false, reason: 'invalid' });
  });

  it('reports email_mismatch when the user email differs', async () => {
    const { client } = makeAcceptAdmin({ inv: invWithHousehold });
    mockSrv.mockReturnValue(client as never);
    const result = await validateInvitation('user-2', 'other@x.com', 'tok-1');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('email_mismatch');
    expect(result.emailMatches).toBe(false);
  });
});
