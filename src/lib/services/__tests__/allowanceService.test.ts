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

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { createClient } from '@/lib/supabase/server';
import { getAllowance, upsertAllowance, getAllowanceStatus } from '@/lib/services/allowanceService';
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

/**
 * MIGRATED to `@/test-utils/supabaseChain`. `clientWith(byTable)` maps directly
 * onto the factory's `tables` option.
 *
 * ONE DIFFERENCE, checked rather than assumed: the hand-rolled default for an
 * UNLISTED table was `{ data: null }`; the factory's is `{ data: [] }`, reshaped
 * to null only on single/maybeSingle. That would change a LIST query on an
 * unlisted table from null to []. No test in this file does that - the
 * negative-amount test returns before from(), and every other test lists the
 * tables its path touches - so the difference cannot change an outcome here.
 *
 * CONTROL-ARM FILE: allowanceService rethrows (logging first), nothing swallowed.
 */
function clientWith(byTable: Record<string, { data: unknown; error: unknown }>) {
  return createSupabaseMock({ tables: byTable as never });
}

beforeEach(() => jest.clearAllMocks());

describe('getAllowance', () => {
  it('returns the row when present', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({ personal_allowances: { data: ALLOWANCE, error: null } }).client as never
    );
    expect(await getAllowance('user-1')).toEqual(ALLOWANCE);
  });

  it('returns null when none exists', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({ personal_allowances: { data: null, error: null } }).client as never
    );
    expect(await getAllowance('user-1')).toBeNull();
  });
});

describe('upsertAllowance', () => {
  it('rejects a negative amount without touching the DB', async () => {
    const db = clientWith({});
    mockCreateClient.mockResolvedValue(db.client as never);
    await expect(upsertAllowance('user-1', { monthly_amount: -5 })).rejects.toThrow(/non-negative/);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdMemberError when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({ household_members: { data: null, error: null } }).client as never
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
      }).client as never
    );
    const result = await upsertAllowance('user-1', { monthly_amount: 200, currency: 'EUR' });
    expect(result).toEqual(ALLOWANCE);
  });

  it('falls back to the default currency for an unsupported code', async () => {
    const db = clientWith({
      household_members: { data: { household_id: 'h-1' }, error: null },
      personal_allowances: { data: ALLOWANCE, error: null },
    });
    mockCreateClient.mockResolvedValue(db.client as never);
    await upsertAllowance('user-1', { monthly_amount: 200, currency: 'ZZZ' });
    // The factory records the upsert directly; no digging through from()'s
    // mock results for whichever chain happened to receive it.
    const upserted = db.callsTo('personal_allowances', 'upsert')[0]![0] as { currency: string };
    expect(upserted.currency).toBe('EUR');
  });
});

describe('getAllowanceStatus', () => {
  it('returns zeroed status when there is no allowance', async () => {
    mockCreateClient.mockResolvedValue(
      clientWith({ personal_allowances: { data: null, error: null } }).client as never
    );
    expect(await getAllowanceStatus('user-1')).toEqual({
      allowance: null,
      spent: 0,
      remaining: null,
    });
  });

  it('sums the current-month allowance spend and computes remaining', async () => {
    // First createClient call → getAllowance; second → the spend query.
    mockCreateClient
      .mockResolvedValueOnce(
        clientWith({ personal_allowances: { data: ALLOWANCE, error: null } }).client as never
      )
      .mockResolvedValueOnce(
        clientWith({
          transactions: { data: [{ amount: 30 }, { amount: 20.5 }], error: null },
        }).client as never
      );
    const status = await getAllowanceStatus('user-1');
    expect(status.allowance).toEqual(ALLOWANCE);
    expect(status.spent).toBe(50.5);
    expect(status.remaining).toBe(149.5);
  });
});
