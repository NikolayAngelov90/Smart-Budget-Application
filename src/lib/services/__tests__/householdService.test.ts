/**
 * householdService tests — Story 13.1
 * Mocked Supabase (service boundary). RLS isolation itself is covered by the
 * real-DB harness (households.rls.test.ts), not here.
 */

// Override the global jest.setup mock to expose BOTH clients.
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createHousehold, getCurrentHousehold, HouseholdExistsError } from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;

const HOUSEHOLD = {
  id: 'h-1',
  name: 'Our Home',
  created_by: 'user-1',
  created_at: '2026-06-03T00:00:00Z',
  updated_at: '2026-06-03T00:00:00Z',
};

interface AdminOpts {
  existingMembership?: object | null;
  existingErr?: object | null;
  household?: object | null;
  householdErr?: object | null;
  memberErr?: object | null;
}

function makeAdminMock(opts: AdminOpts) {
  const { existingMembership = null, existingErr = null, household = HOUSEHOLD, householdErr = null, memberErr = null } = opts;
  const deleteEq = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn((table: string) => {
    if (table === 'household_members') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: existingMembership, error: existingErr }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: memberErr }),
      };
    }
    // households
    return {
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: household, error: householdErr }),
        }),
      }),
      delete: jest.fn().mockReturnValue({ eq: deleteEq }),
    };
  });
  return { client: { from }, deleteEq };
}

function makeUserMock(membership: object | null, error: object | null = null) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: membership, error }),
        }),
      }),
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('createHousehold', () => {
  it('creates a household and returns the caller as admin', async () => {
    const { client } = makeAdminMock({});
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    const result = await createHousehold('user-1', '  Our Home  ');

    expect(result).toEqual({ ...HOUSEHOLD, role: 'admin' });
    // name is trimmed before insert
    const householdsFrom = client.from.mock.calls.find((c) => c[0] === 'households');
    expect(householdsFrom).toBeTruthy();
  });

  it('throws HouseholdExistsError when the user already belongs to a household', async () => {
    const { client } = makeAdminMock({ existingMembership: { id: 'm-1' } });
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    await expect(createHousehold('user-1', 'Second Home')).rejects.toBeInstanceOf(HouseholdExistsError);
  });

  it('rejects an empty/whitespace name without touching the database', async () => {
    const { client } = makeAdminMock({});
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    await expect(createHousehold('user-1', '   ')).rejects.toThrow(/1–100 characters/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 100 characters', async () => {
    const { client } = makeAdminMock({});
    mockCreateServiceRoleClient.mockReturnValue(client as never);
    await expect(createHousehold('user-1', 'x'.repeat(101))).rejects.toThrow(/1–100 characters/);
  });

  it('rolls back the household when the membership insert fails', async () => {
    const { client, deleteEq } = makeAdminMock({ memberErr: { message: 'boom' } });
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    await expect(createHousehold('user-1', 'Our Home')).rejects.toThrow(/membership/);
    expect(deleteEq).toHaveBeenCalledWith('id', HOUSEHOLD.id);
  });
});

describe('getCurrentHousehold', () => {
  it('returns the household with the user role', async () => {
    mockCreateClient.mockResolvedValue(
      makeUserMock({ role: 'admin', households: HOUSEHOLD }) as never
    );

    const result = await getCurrentHousehold('user-1');
    expect(result).toEqual({ ...HOUSEHOLD, role: 'admin', preset: null });
  });

  it('returns null when the user has no household', async () => {
    mockCreateClient.mockResolvedValue(makeUserMock(null) as never);
    const result = await getCurrentHousehold('user-1');
    expect(result).toBeNull();
  });
});
