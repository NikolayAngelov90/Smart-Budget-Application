/**
 * @jest-environment node
 */

/**
 * Shared-category permissions — DW-5 decisions #3 and #4.
 *
 * Two things were wrong. Renaming a shared category relabels every member's
 * spending history, but any member could do it. And deleting one counted only
 * the CALLER's transactions, because that count is RLS-scoped — so for a shared
 * category the delete either failed on the FK (`transactions.category_id` is NOT
 * NULL, ON DELETE RESTRICT) or partially orphaned: the caller's rows reassigned,
 * everyone else's left pointing at a row about to vanish.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/services/householdService', () => ({
  getCurrentHousehold: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getCurrentHousehold } from '@/lib/services/householdService';
import { PUT, DELETE } from '../route';
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;
const mockHousehold = getCurrentHousehold as jest.MockedFunction<typeof getCurrentHousehold>;

const USER = 'user-1';

interface CategoryRow {
  id: string;
  name: string;
  is_predefined: boolean;
  type: string;
  user_id?: string;
  household_id: string | null;
}

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`, and what it found:
 *
 * THREE PUT TESTS PASSED BECAUSE THE ROUTE CRASHED. The hand-rolled category
 * chain had no `update`, so every PUT that reached the write threw a TypeError
 * into the route's catch and returned 500 - and "is allowed for an admin",
 * "does not gate a PERSONAL category" and "does not gate a colour-only edit"
 * asserted only `status not 403`, which a crash satisfies. The logger is
 * mocked in this file, so the masked-failure detector could not see the
 * swallow either. Probed before migrating: all three returned 500. They now
 * assert 200, which is what "allowed" means.
 *
 * categories is a QUEUE in the handler's call order, per flow:
 *   rename    [fetch, duplicate check (none), update]
 *   recolour  [fetch, update]           (no duplicate check without a name)
 *   delete    [fetch, delete]
 */
type Flow = 'rename' | 'recolour' | 'delete';

/** Caller-scoped client: category lookup plus an RLS-scoped transaction count. */
function makeClient(category: CategoryRow, ownTxCount = 0, flow: Flow = 'rename') {
  const row = { data: category, error: null };
  const none = { data: null, error: null };
  const categories =
    flow === 'rename' ? [row, none, row] : flow === 'recolour' ? [row, row] : [row, none];
  return createSupabaseMock({
    user: { id: USER },
    tables: { categories, transactions: { data: null, count: ownTxCount, error: null } },
  }).client;
}

/** Service-role client: counts OTHER members' transactions. */
function makeServiceClient(otherCount: number, error: unknown = null) {
  return createSupabaseMock({
    tables: { transactions: { data: null, count: otherCount, error } },
  });
}

const req = (body?: unknown) =>
  ({
    url: 'http://localhost:3000/api/categories/c1',
    json: async () => body ?? {},
  }) as never;

const params = { params: Promise.resolve({ id: 'c1' }) };

const SHARED: CategoryRow = {
  id: 'c1',
  name: 'Groceries',
  is_predefined: false,
  type: 'expense',
  user_id: USER,
  household_id: 'hh-1',
};
const PERSONAL: CategoryRow = { ...SHARED, household_id: null };

const asRole = (role: 'admin' | 'member') =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockHousehold.mockResolvedValue({ id: 'hh-1', role } as any);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('renaming a shared category', () => {
  it('is refused for a non-admin member', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    asRole('member');

    const res = await PUT(req({ name: 'Food' }), params);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin/i);
  });

  it('is allowed for an admin', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    asRole('admin');

    const res = await PUT(req({ name: 'Food' }), params);

    expect(res.status).toBe(200);
  });

  it('does not gate a PERSONAL category on household role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(PERSONAL) as any);
    asRole('member');

    const res = await PUT(req({ name: 'Food' }), params);

    expect(res.status).toBe(200);
    // No household lookup needed for a personal category.
    expect(mockHousehold).not.toHaveBeenCalled();
  });

  it('does not gate a colour-only edit of a shared category', async () => {
    // Recolouring does not relabel anyone's history, so it stays open to members.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED, 0, 'recolour') as any);
    asRole('member');

    const res = await PUT(req({ color: '#0B5E4A' }), params);

    expect(res.status).toBe(200);
  });
});

describe('deleting a shared category', () => {
  it('is refused for a non-admin member', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED, 0, 'delete') as any);
    asRole('member');

    const res = await DELETE(req(), params);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin/i);
  });

  it('refuses with a reason while other members still use it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED, 0, 'delete') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(makeServiceClient(3).client as any);
    asRole('admin');

    const res = await DELETE(req(), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.sharedInUse).toBe(true);
    expect(body.otherMemberTransactionCount).toBe(3);
  });

  it('counts only OTHER members, not the caller', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED, 0, 'delete') as any);
    const service = makeServiceClient(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(service.client as any);
    asRole('admin');

    await DELETE(req(), params);

    // The exclusion is the whole point: without `.neq('user_id', …)` an admin
    // could never delete a shared category they had used themselves.
    expect(service.callsTo('transactions', 'neq')).toContainEqual(['user_id', USER]);
  });

  it('does not consult the service role for a PERSONAL category', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(PERSONAL, 0, 'delete') as any);
    asRole('member');

    await DELETE(req(), params);

    expect(mockServiceClient).not.toHaveBeenCalled();
  });

  it('500s rather than deleting when the shared-usage check fails', async () => {
    // Degradation policy: this is a core input, not an enrichment. Proceeding
    // would risk exactly the partial orphaning this guard exists to prevent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED, 0, 'delete') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(makeServiceClient(0, { message: 'boom' }).client as any);
    asRole('admin');

    const res = await DELETE(req(), params);

    expect(res.status).toBe(500);
  });
});
