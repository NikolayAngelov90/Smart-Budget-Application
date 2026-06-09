/**
 * householdMemberService tests — Story 13.11
 * Mocked Supabase. Real revocation behavior is covered by member-removal.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceRoleClient: jest.fn() }));
jest.mock('@/lib/services/pushService', () => ({ sendPushToUser: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/services/pushService';
import {
  listHouseholdMembers,
  removeMember,
  CannotRemoveSelfError,
  MemberNotFoundError,
} from '@/lib/services/householdMemberService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockPush = sendPushToUser as jest.MockedFunction<typeof sendPushToUser>;

interface AdminOpts {
  adminRow?: object | null;
  targetRow?: object | null;
  deleteError?: object | null;
}

function adminClient({ adminRow = { household_id: 'h', role: 'admin' }, targetRow = { id: 'm' }, deleteError = null }: AdminOpts) {
  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({ data: adminRow, error: null }) // admin lookup
    .mockResolvedValueOnce({ data: targetRow, error: null }); // target lookup
  const inner = { eq: jest.fn().mockReturnThis(), maybeSingle };
  const deleteEq = { eq: jest.fn().mockReturnThis(), then: (r: (v: unknown) => unknown) => r({ error: deleteError }) };
  const hm = { select: jest.fn(() => inner), delete: jest.fn(() => deleteEq) };
  const households = {
    select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: { name: 'Home' }, error: null }) })) })),
  };
  // categories/goals reassignment: .update(...).eq().eq() → resolves { error: null }
  const reassign = () => {
    const update = jest.fn(() => ({ eq: jest.fn().mockReturnThis(), then: (r: (v: unknown) => unknown) => r({ error: null }) }));
    return { update };
  };
  const categories = reassign();
  const goals = reassign();
  const from = jest.fn((t: string) => {
    if (t === 'households') return households;
    if (t === 'categories') return categories;
    if (t === 'goals') return goals;
    return hm;
  });
  return { from, _deleteEq: deleteEq, _categories: categories, _goals: goals };
}

beforeEach(() => jest.clearAllMocks());

describe('removeMember', () => {
  it('rejects removing yourself before any DB work', async () => {
    await expect(removeMember('u1', 'u1')).rejects.toBeInstanceOf(CannotRemoveSelfError);
    expect(mockServiceClient).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdAdminError when the caller is not an admin', async () => {
    mockServiceClient.mockReturnValue(adminClient({ adminRow: { household_id: 'h', role: 'member' } }) as never);
    await expect(removeMember('admin', 'target')).rejects.toBeInstanceOf(NotHouseholdAdminError);
  });

  it('throws MemberNotFoundError when the target is not in the household', async () => {
    mockServiceClient.mockReturnValue(adminClient({ targetRow: null }) as never);
    await expect(removeMember('admin', 'target')).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it('deletes the membership row, reassigns shared categories/goals to the admin, and notifies', async () => {
    const client = adminClient({});
    mockServiceClient.mockReturnValue(client as never);
    await removeMember('admin', 'target');
    expect(client._deleteEq.eq).toHaveBeenCalled();
    // residual owner-branch severed: shared categories + goals reassigned to the admin
    expect(client._categories.update).toHaveBeenCalledWith({ user_id: 'admin' });
    expect(client._goals.update).toHaveBeenCalledWith({ user_id: 'admin' });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]![1]).toBe('target');
  });
});

describe('listHouseholdMembers', () => {
  it('returns [] when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue({
      from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })),
      rpc: jest.fn(),
    } as never);
    expect(await listHouseholdMembers('u')).toEqual([]);
  });

  it('returns members with isSelf computed', async () => {
    mockCreateClient.mockResolvedValue({
      from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { household_id: 'h' }, error: null }) })),
      rpc: jest.fn().mockResolvedValue({
        data: [
          { user_id: 'u', email: 'me@x.test', role: 'admin', joined_at: 't' },
          { user_id: 'v', email: 'them@x.test', role: 'member', joined_at: 't' },
        ],
        error: null,
      }),
    } as never);
    const members = await listHouseholdMembers('u');
    expect(members.find((m) => m.user_id === 'u')!.isSelf).toBe(true);
    expect(members.find((m) => m.user_id === 'v')!.isSelf).toBe(false);
  });
});
