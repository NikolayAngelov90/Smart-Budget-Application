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

import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  NotHouseholdAdminError,
  InvitationExistsError,
  InvitationNotFoundError,
} from '@/lib/services/invitationService';

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
}

function makeAdmin(opts: AdminOpts = {}) {
  const {
    member = { household_id: 'h-1', role: 'admin' },
    memberErr = null,
    precheck = null,
    insert = { data: INVITE, error: null },
    revokeLookup,
    thenResult = { data: [INVITE], error: null },
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
  return { client: { from }, membersChain, invChain };
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
