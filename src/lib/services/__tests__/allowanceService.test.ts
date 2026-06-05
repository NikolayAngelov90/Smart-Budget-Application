/**
 * allowanceService tests — Story 13.6
 * Mocked Supabase (service boundary). Real owner-only RLS is covered by the harness
 * (allowance.rls.test.ts), not here.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  getAllowance,
  upsertAllowance,
  getAllowanceStatus,
} from '@/lib/services/allowanceService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const ALLOWANCE = {
  id: 'allw-1',
  user_id: 'user-1',
  household_id: 'h-1',
  monthly_amount: 200,
  currency: 'EUR',
  created_at: '2026-06-05T00:00:00Z',
  updated_at: '2026-06-05T00:00:00Z',
};

/** A chainable query stub: every method returns `this`; terminals resolve to `result`. */
function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'gte', 'upsert', 'delete']) {
    q[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  // Allow `await chain` for queries that end on a filter (e.g. .gte()).
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

function clientWith(byTable: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: jest.fn((table: string) => chain(byTable[table] ?? { data: null, error: null })),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getAllowance', () => {
  it('returns the row when present', async () => {
    mockCreateClient.mockResolvedValue(clientWith({ personal_allowances: { data: ALLOWANCE, error: null } }) as never);
    expect(await getAllowance('user-1')).toEqual(ALLOWANCE);
  });

  it('returns null when none exists', async () => {
    mockCreateClient.mockResolvedValue(clientWith({ personal_allowances: { data: null, error: null } }) as never);
    expect(await getAllowance('user-1')).toBeNull();
  });
});

describe('upsertAllowance', () => {
  it('rejects a negative amount without touching the DB', async () => {
    const client = clientWith({});
    mockCreateClient.mockResolvedValue(client as never);
    await expect(upsertAllowance('user-1', { monthly_amount: -5 })).rejects.toThrow(/non-negative/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdMemberError when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({ household_members: { data: null, error: null } }) as never
    );
    await expect(upsertAllowance('user-1', { monthly_amount: 100 })).rejects.toBeInstanceOf(
      NotHouseholdMemberError
    );
  });

  it('upserts and returns the allowance for a member', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({
        household_members: { data: { household_id: 'h-1' }, error: null },
        personal_allowances: { data: ALLOWANCE, error: null },
      }) as never
    );
    const result = await upsertAllowance('user-1', { monthly_amount: 200, currency: 'EUR' });
    expect(result).toEqual(ALLOWANCE);
  });

  it('falls back to the default currency for an unsupported code', async () => {
    const client = clientWith({
      household_members: { data: { household_id: 'h-1' }, error: null },
      personal_allowances: { data: ALLOWANCE, error: null },
    });
    mockCreateClient.mockResolvedValue(client as never);
    await upsertAllowance('user-1', { monthly_amount: 200, currency: 'ZZZ' });
    const upsertCall = client.from.mock.results
      .map((r) => r.value as ReturnType<typeof chain>)
      .find((q) => (q.upsert as jest.Mock).mock.calls.length > 0);
    expect((upsertCall!.upsert as jest.Mock).mock.calls[0][0].currency).toBe('EUR');
  });
});

describe('getAllowanceStatus', () => {
  it('returns zeroed status when there is no allowance', async () => {
    mockCreateClient.mockResolvedValue(clientWith({ personal_allowances: { data: null, error: null } }) as never);
    expect(await getAllowanceStatus('user-1')).toEqual({ allowance: null, spent: 0, remaining: null });
  });

  it('sums the current-month allowance spend and computes remaining', async () => {
    // First createClient call → getAllowance; second → the spend query.
    mockCreateClient
      .mockResolvedValueOnce(clientWith({ personal_allowances: { data: ALLOWANCE, error: null } }) as never)
      .mockResolvedValueOnce(
        clientWith({ transactions: { data: [{ amount: 30 }, { amount: 20.5 }], error: null } }) as never
      );
    const status = await getAllowanceStatus('user-1');
    expect(status.allowance).toEqual(ALLOWANCE);
    expect(status.spent).toBe(50.5);
    expect(status.remaining).toBe(149.5);
  });
});
