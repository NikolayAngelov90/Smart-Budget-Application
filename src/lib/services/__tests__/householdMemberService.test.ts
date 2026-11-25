/**
 * householdMemberService tests — Story 13.11
 * Mocked Supabase. Real revocation behavior is covered by member-removal.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/services/pushService', () => ({ dispatchCategorizedPush: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import {
  listHouseholdMembers,
  removeMember,
  CannotRemoveSelfError,
  MemberNotFoundError,
} from '@/lib/services/householdMemberService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;
const mockPush = dispatchCategorizedPush as jest.MockedFunction<typeof dispatchCategorizedPush>;

interface AdminOpts {
  adminRow?: object | null;
  targetRow?: object | null;
  deleteError?: object | null;
}

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. household_members is a
 * QUEUE in from() order: the admin lookup, the target lookup, the delete.
 */
function adminClient({
  adminRow = { household_id: 'h', role: 'admin' },
  targetRow = { id: 'm' },
  deleteError = null,
}: AdminOpts) {
  return createSupabaseMock({
    tables: {
      household_members: [
        { data: adminRow, error: null }, // admin lookup
        { data: targetRow, error: null }, // target lookup
        { data: null, error: deleteError }, // the delete
      ],
      households: { data: { name: 'Home' }, error: null },
      categories: { data: null, error: null },
      goals: { data: null, error: null },
    },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('removeMember', () => {
  it('rejects removing yourself before any DB work', async () => {
    await expect(removeMember('u1', 'u1')).rejects.toBeInstanceOf(CannotRemoveSelfError);
    expect(mockServiceClient).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdAdminError when the caller is not an admin', async () => {
    mockServiceClient.mockReturnValue(
      adminClient({ adminRow: { household_id: 'h', role: 'member' } }).client
    );
    await expect(removeMember('admin', 'target')).rejects.toBeInstanceOf(NotHouseholdAdminError);
  });

  it('throws MemberNotFoundError when the target is not in the household', async () => {
    mockServiceClient.mockReturnValue(adminClient({ targetRow: null }).client);
    await expect(removeMember('admin', 'target')).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it("removes in ONE transaction - shared objects to the owner, the owner's notices, the membership delete - and notifies the removed person", async () => {
    const db = adminClient({});
    mockServiceClient.mockReturnValue(db.client);
    await removeMember('admin', 'target');

    // The single transaction (remove_household_member, migration 20261125100000),
    // for THIS household and THIS member. What it does - only this member's shared
    // rows move, the membership row goes, the owner is told, and all of it rolls
    // back together - is tested against Postgres in account-deletion.rls.test.ts.
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    expect(db.client.rpc).toHaveBeenCalledWith('remove_household_member', {
      p_household: 'h',
      p_member: 'target',
    });
    // No second, separate write that could fail after the first succeeded.
    expect(db.allCallsTo('household_members', 'delete')).toEqual([]);
    expect(db.allCallsTo('categories', 'update')).toEqual([]);
    expect(db.allCallsTo('goals', 'update')).toEqual([]);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]![0]).toBe('target');
    expect(mockPush.mock.calls[0]![1]).toBe('household'); // category gate (15.5)
  });

  it('FAILS CLOSED when the removal transaction fails: it throws, and nobody is notified', async () => {
    // One transaction, so a failure changed nothing. This also covers the deploy
    // window: before the migration exists, the RPC errors and the removal is a
    // clean 500 with nothing half-done.
    const db = adminClient({});
    (db.client.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'function remove_household_member does not exist' },
    });
    mockServiceClient.mockReturnValue(db.client);

    await expect(removeMember('admin', 'target')).rejects.toThrow('Failed to remove member');
    // PAIRED: the removal was attempted, so "no push" is the guard working.
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('listHouseholdMembers', () => {
  it('returns [] when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ tables: { household_members: { data: null, error: null } } }).client
    );
    expect(await listHouseholdMembers('u')).toEqual([]);
  });

  it('returns members with isSelf computed', async () => {
    const db = createSupabaseMock({
      tables: { household_members: { data: { household_id: 'h' }, error: null } },
    });
    (db.client.rpc as jest.Mock).mockResolvedValue({
      data: [
        { user_id: 'u', email: 'me@x.test', role: 'admin', joined_at: 't' },
        { user_id: 'v', email: 'them@x.test', role: 'member', joined_at: 't' },
      ],
      error: null,
    });
    mockCreateClient.mockResolvedValue(db.client);
    const members = await listHouseholdMembers('u');
    expect(members.find((m) => m.user_id === 'u')!.isSelf).toBe(true);
    expect(members.find((m) => m.user_id === 'v')!.isSelf).toBe(false);
  });
});
