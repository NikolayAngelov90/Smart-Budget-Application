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

  it('deletes the membership row, reassigns shared categories/goals to the admin, and notifies', async () => {
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

    // Residual owner-branch severed: the REMOVED member's shared categories and
    // goals are reassigned to the admin - and ONLY theirs. Without the user_id
    // filter every shared row in the household, other members' included, would
    // be handed to the admin; the old assertion checked the payload only.
    for (const table of ['categories', 'goals']) {
      expect(db.callsTo(table, 'update')).toEqual([[{ user_id: 'admin' }]]);
      expect(db.callsTo(table, 'eq')).toEqual(
        expect.arrayContaining([
          ['user_id', 'target'],
          ['household_id', 'h'],
        ])
      );
    }
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]![0]).toBe('target');
    expect(mockPush.mock.calls[0]![1]).toBe('household'); // category gate (15.5)
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
