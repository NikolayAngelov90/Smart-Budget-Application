/**
 * householdGoalService tests — Story 13.9
 * Mocked Supabase. Real RLS/RPC behavior covered by household-goals.rls.test.ts.
 *
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. The hand-rolled `chain`
 * answered PER TERMINAL - one `goals` chain returned the lookup row from
 * maybeSingle() and the recomputed total from single() - because one object
 * served every from() call. Production makes those as SEPARATE from() calls,
 * so they are per-table queues in call order: goals [lookup, update],
 * goal_contributions [insert, sum].
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/services/savingsTransactionService', () => ({
  logSavingsContribution: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { logSavingsContribution } from '@/lib/services/savingsTransactionService';
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain';
import {
  getHouseholdGoals,
  createHouseholdGoal,
  contributeToHouseholdGoal,
  GoalNotFoundError,
} from '@/lib/services/householdGoalService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;
const mockLogSavings = logSavingsContribution as jest.MockedFunction<typeof logSavingsContribution>;

/** A factory client; an array is a queue consumed in from() order. */
function db(
  tables: Record<string, QueryResult | QueryResult[]>,
  rpcResult: unknown = { data: [], error: null }
) {
  const m = createSupabaseMock({ tables });
  (m.client.rpc as jest.Mock).mockResolvedValue(rpcResult);
  return m;
}

beforeEach(() => jest.clearAllMocks());

describe('createHouseholdGoal', () => {
  it('rejects a non-positive target without touching the DB', async () => {
    await expect(createHouseholdGoal('u', { name: 'X', target_amount: 0 })).rejects.toThrow(
      /greater than 0/
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdMemberError when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(
      db({ household_members: { data: null, error: null } }).client
    );

    await expect(
      createHouseholdGoal('u', { name: 'X', target_amount: 100 })
    ).rejects.toBeInstanceOf(NotHouseholdMemberError);
  });

  it('creates a shared goal for a member', async () => {
    mockCreateClient.mockResolvedValue(
      db({ household_members: { data: { household_id: 'h' }, error: null } }).client
    );
    const GOAL = { id: 'g1', household_id: 'h', name: 'Vacation', target_amount: 1000 };
    mockServiceClient.mockReturnValue(db({ goals: { data: GOAL, error: null } }).client);

    const result = await createHouseholdGoal('u', { name: 'Vacation', target_amount: 1000 });
    expect(result).toEqual(GOAL);
  });
});

describe('contributeToHouseholdGoal', () => {
  it('rejects a non-positive amount', async () => {
    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 0 })).rejects.toThrow(
      /greater than 0/
    );
  });

  it('throws GoalNotFoundError for a missing or non-shared goal', async () => {
    mockServiceClient.mockReturnValue(db({ goals: { data: null, error: null } }).client);

    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 50 })).rejects.toBeInstanceOf(
      GoalNotFoundError
    );
  });

  it('throws NotHouseholdMemberError when caller is not in the goal’s household', async () => {
    mockServiceClient.mockReturnValue(
      db({
        goals: { data: { id: 'g1', name: 'V', household_id: 'h' }, error: null },
        household_members: { data: null, error: null }, // not a member
      }).client
    );

    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 50 })).rejects.toBeInstanceOf(
      NotHouseholdMemberError
    );
  });

  it('records the contribution, logs the Savings expense, and recomputes the total', async () => {
    const admin = db({
      goals: [
        { data: { id: 'g1', name: 'Vacation', household_id: 'h' }, error: null }, // lookup
        { data: { id: 'g1', current_amount: 150 }, error: null }, // recompute update
      ],
      household_members: { data: { id: 'm' }, error: null },
      goal_contributions: [
        { data: { id: 'gc1' }, error: null }, // insert
        { data: [{ amount: 100 }, { amount: 50 }], error: null }, // the SUM read
      ],
    });
    mockCreateClient.mockResolvedValue(
      db({
        user_profiles: { data: { preferences: { currency_format: 'EUR' } }, error: null },
      }).client
    );
    mockServiceClient.mockReturnValue(admin.client);

    const result = await contributeToHouseholdGoal('u', 'g1', { amount: 50 });
    expect(mockLogSavings).toHaveBeenCalledTimes(1);
    expect(mockLogSavings.mock.calls[0]![1]).toMatchObject({
      amount: 50,
      goalContributionId: 'gc1',
      goalName: 'Vacation',
    });
    expect((result as { current_amount: number }).current_amount).toBe(150);
    // recompute updated goals with SUM(100+50)=150 - on THIS goal
    expect(admin.callsTo('goals', 'update', 1)).toEqual([[{ current_amount: 150 }]]);
    expect(admin.callsTo('goals', 'eq', 1)).toContainEqual(['id', 'g1']);
  });
});

describe('getHouseholdGoals', () => {
  it('returns [] when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(
      db({ household_members: { data: null, error: null } }).client
    );
    expect(await getHouseholdGoals('u')).toEqual([]);
  });

  it('attaches the per-member breakdown to each goal', async () => {
    const GOAL = {
      id: 'g1',
      household_id: 'h',
      name: 'Vacation',
      target_amount: 1000,
      current_amount: 150,
    };
    mockCreateClient.mockResolvedValue(
      db(
        {
          household_members: { data: { household_id: 'h' }, error: null },
          goals: { data: [GOAL], error: null },
        },
        { data: [{ user_id: 'u', email: 'a@x.test', contributed: 100 }], error: null }
      ).client
    );

    const result = await getHouseholdGoals('u');
    expect(result).toHaveLength(1);
    expect(result[0]!.goal).toEqual(GOAL);
    expect(result[0]!.breakdown).toEqual([{ user_id: 'u', email: 'a@x.test', contributed: 100 }]);
  });
});
