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

/** Caller-scoped client: category lookup plus an RLS-scoped transaction count. */
function makeClient(category: CategoryRow, ownTxCount = 0) {
  const categoryChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: category, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  const txChain = {
    select: jest.fn(() => Promise.resolve({ count: ownTxCount, error: null })),
    eq: jest.fn().mockReturnThis(),
  };
  // `.select('id', { count }).eq('category_id', id)` — resolve on eq.
  txChain.select = jest.fn(() => txChain as never);
  (txChain as unknown as { eq: jest.Mock }).eq = jest.fn(() =>
    Promise.resolve({ count: ownTxCount, error: null })
  );

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER } }, error: null }),
    },
    from: jest.fn((table: string) => (table === 'categories' ? categoryChain : txChain)),
  };
}

/** Service-role client: counts OTHER members' transactions. */
function makeServiceClient(otherCount: number, error: unknown = null) {
  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => Promise.resolve({ count: otherCount, error })),
  };
  return { from: jest.fn(() => chain) };
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

    expect(res.status).not.toBe(403);
  });

  it('does not gate a PERSONAL category on household role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(PERSONAL) as any);
    asRole('member');

    const res = await PUT(req({ name: 'Food' }), params);

    expect(res.status).not.toBe(403);
    // No household lookup needed for a personal category.
    expect(mockHousehold).not.toHaveBeenCalled();
  });

  it('does not gate a colour-only edit of a shared category', async () => {
    // Recolouring does not relabel anyone's history, so it stays open to members.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    asRole('member');

    const res = await PUT(req({ color: '#0B5E4A' }), params);

    expect(res.status).not.toBe(403);
  });
});

describe('deleting a shared category', () => {
  it('is refused for a non-admin member', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    asRole('member');

    const res = await DELETE(req(), params);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/admin/i);
  });

  it('refuses with a reason while other members still use it', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(makeServiceClient(3) as any);
    asRole('admin');

    const res = await DELETE(req(), params);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.sharedInUse).toBe(true);
    expect(body.otherMemberTransactionCount).toBe(3);
  });

  it('counts only OTHER members, not the caller', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    const service = makeServiceClient(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(service as any);
    asRole('admin');

    await DELETE(req(), params);

    // The exclusion is the whole point: without `.neq('user_id', …)` an admin
    // could never delete a shared category they had used themselves.
    const chain = service.from.mock.results[0]!.value as { neq: jest.Mock };
    expect(chain.neq).toHaveBeenCalledWith('user_id', USER);
  });

  it('does not consult the service role for a PERSONAL category', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(PERSONAL) as any);
    asRole('member');

    await DELETE(req(), params);

    expect(mockServiceClient).not.toHaveBeenCalled();
  });

  it('500s rather than deleting when the shared-usage check fails', async () => {
    // Degradation policy: this is a core input, not an enrichment. Proceeding
    // would risk exactly the partial orphaning this guard exists to prevent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateClient.mockResolvedValue(makeClient(SHARED) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockServiceClient.mockReturnValue(makeServiceClient(0, { message: 'boom' }) as any);
    asRole('admin');

    const res = await DELETE(req(), params);

    expect(res.status).toBe(500);
  });
});
