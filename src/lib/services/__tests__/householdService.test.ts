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

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  createHousehold,
  getCurrentHousehold,
  HouseholdExistsError,
} from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateServiceRoleClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;

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

/**
 * MIGRATED to `@/test-utils/supabaseChain`. createHousehold touches each table
 * twice, so each is a two-entry queue consumed in from() order:
 *
 *   household_members   lookup (select...maybeSingle)  -> membership insert
 *   households          insert...select...single       -> rollback delete...eq
 *
 * The rollback's `deleteEq` used to be a dedicated jest.fn threaded back out of
 * the helper; it is now simply the `eq` on the second households chain, which
 * the factory records like every other call.
 *
 * CONTROL-ARM FILE: householdService rethrows; nothing here is swallowed.
 */
function makeAdminMock(opts: AdminOpts) {
  const {
    existingMembership = null,
    existingErr = null,
    household = HOUSEHOLD,
    householdErr = null,
    memberErr = null,
  } = opts;
  const db = createSupabaseMock({
    tables: {
      household_members: [
        { data: existingMembership, error: existingErr },
        { data: null, error: memberErr },
      ],
      households: [
        { data: household, error: householdErr },
        { data: null, error: null },
      ],
    },
  });
  return { db, client: db.client };
}

function makeUserMock(membership: object | null, error: object | null = null) {
  return createSupabaseMock({ tables: { household_members: { data: membership, error } } }).client;
}

beforeEach(() => jest.clearAllMocks());

describe('createHousehold', () => {
  it('creates a household and returns the caller as admin', async () => {
    const { client } = makeAdminMock({});
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    const result = await createHousehold('user-1', '  Our Home  ');

    expect(result).toEqual({ ...HOUSEHOLD, role: 'admin' });
    // The households table is reached. The TRIM is not checked: nothing here
    // inspects the insert payload.
    const householdsFrom = client.from.mock.calls.find((c: unknown[]) => c[0] === 'households');
    expect(householdsFrom).toBeTruthy();
  });

  it('throws HouseholdExistsError when the user already belongs to a household', async () => {
    const { client } = makeAdminMock({ existingMembership: { id: 'm-1' } });
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    await expect(createHousehold('user-1', 'Second Home')).rejects.toBeInstanceOf(
      HouseholdExistsError
    );
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
    const { db, client } = makeAdminMock({ memberErr: { message: 'boom' } });
    mockCreateServiceRoleClient.mockReturnValue(client as never);

    await expect(createHousehold('user-1', 'Our Home')).rejects.toThrow(/membership/);
    // The rollback is the SECOND households chain: index 1.
    expect(db.chainFor('households', 1).eq).toHaveBeenCalledWith('id', HOUSEHOLD.id);
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
