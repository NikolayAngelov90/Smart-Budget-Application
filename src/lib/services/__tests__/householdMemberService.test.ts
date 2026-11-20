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

  it("deletes the membership row, hands the member's shared objects to the owner through the one shared function, and notifies", async () => {
    const db = adminClient({});
    mockServiceClient.mockReturnValue(db.client);
    await removeMember('admin', 'target');

    // The delete is THIS member's row in THIS household. It used to assert only
    // that the delete chain's `eq` was CALLED - an arg-blind check that stays
    // green with either filter gone.
    expect(db.callsTo('household_members', 'delete', 2)).toHaveLength(1);
    expect(db.callsTo('household_members', 'eq', 2)).toEqual(
      expect.arrayContaining([
        ['household_id', 'h'],
        ['user_id', 'target'],
      ])
    );

    // Residual owner-branch severed - through the ONE shared definition,
    // reassign_member_shared_objects, which account deletion also uses. The scope
    // guard (ONLY this member's shared rows move; a missing user_id filter would
    // hand every member's to the owner) now lives in that SQL function and is
    // tested against Postgres in account-deletion.rls.test.ts. Here: the right
    // household and the right member are passed.
    expect(db.client.rpc).toHaveBeenCalledWith('reassign_member_shared_objects', {
      p_household: 'h',
      p_member: 'target',
    });
    expect(db.allCallsTo('categories', 'update')).toEqual([]);
    expect(db.allCallsTo('goals', 'update')).toEqual([]);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]![0]).toBe('target');
    expect(mockPush.mock.calls[0]![1]).toBe('household'); // category gate (15.5)
  });

  it('FAILS CLOSED when the reassignment fails: it throws, and the membership is never deleted', async () => {
    // The reassignment runs BEFORE the delete. It used to run after it with its
    // error only logged, leaving an ex-member who still owned shared objects and
    // nothing to retry. This also covers the deploy window: before the migration
    // exists, the RPC errors and the removal changes nothing.
    const db = adminClient({});
    (db.client.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'function reassign_member_shared_objects does not exist' },
    });
    mockServiceClient.mockReturnValue(db.client);

    await expect(removeMember('admin', 'target')).rejects.toThrow('Failed to remove member');
    // PAIRED: the reassignment was attempted, so "no delete" is the guard working.
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    expect(db.allCallsTo('household_members', 'delete')).toEqual([]);
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
