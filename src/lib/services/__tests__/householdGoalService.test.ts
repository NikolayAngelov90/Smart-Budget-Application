/**
 * householdGoalService tests — Story 13.9
 * Mocked Supabase. Real RLS/RPC behavior covered by household-goals.rls.test.ts.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/services/savingsTransactionService', () => ({ logSavingsContribution: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { logSavingsContribution } from '@/lib/services/savingsTransactionService';
import {
  getHouseholdGoals,
  createHouseholdGoal,
  contributeToHouseholdGoal,
  GoalNotFoundError,
} from '@/lib/services/householdGoalService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockLogSavings = logSavingsContribution as jest.MockedFunction<typeof logSavingsContribution>;

/** Chainable table stub: chain methods return `this`; terminals resolve to configured values. */
function chain(cfg: { maybeSingle?: unknown; single?: unknown; then?: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'order', 'update', 'insert']) q[m] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null });
  q.single = jest.fn().mockResolvedValue(cfg.single ?? { data: null, error: null });
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve(cfg.then ?? { data: [], error: null });
  return q;
}

function authClient(tables: Record<string, ReturnType<typeof chain>>, rpcResult: unknown = { data: [], error: null }) {
  return { from: jest.fn((t: string) => tables[t] ?? chain({})), rpc: jest.fn().mockResolvedValue(rpcResult) };
}

beforeEach(() => jest.clearAllMocks());

describe('createHouseholdGoal', () => {
  it('rejects a non-positive target without touching the DB', async () => {
    await expect(createHouseholdGoal('u', { name: 'X', target_amount: 0 })).rejects.toThrow(/greater than 0/);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('throws NotHouseholdMemberError when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ household_members: chain({ maybeSingle: { data: null, error: null } }) }) as never);
    await expect(createHouseholdGoal('u', { name: 'X', target_amount: 100 })).rejects.toBeInstanceOf(NotHouseholdMemberError);
  });

  it('creates a shared goal for a member', async () => {
    mockCreateClient.mockResolvedValue(authClient({ household_members: chain({ maybeSingle: { data: { household_id: 'h' }, error: null } }) }) as never);
    const GOAL = { id: 'g1', household_id: 'h', name: 'Vacation', target_amount: 1000 };
    mockServiceClient.mockReturnValue({ from: jest.fn(() => chain({ single: { data: GOAL, error: null } })) } as never);
    const result = await createHouseholdGoal('u', { name: 'Vacation', target_amount: 1000 });
    expect(result).toEqual(GOAL);
  });
});

describe('contributeToHouseholdGoal', () => {
  it('rejects a non-positive amount', async () => {
    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 0 })).rejects.toThrow(/greater than 0/);
  });

  it('throws GoalNotFoundError for a missing or non-shared goal', async () => {
    mockServiceClient.mockReturnValue({ from: jest.fn(() => chain({ maybeSingle: { data: null, error: null } })) } as never);
    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 50 })).rejects.toBeInstanceOf(GoalNotFoundError);
  });

  it('throws NotHouseholdMemberError when caller is not in the goal’s household', async () => {
    const admin = {
      from: jest.fn((t: string) =>
        t === 'goals'
          ? chain({ maybeSingle: { data: { id: 'g1', name: 'V', household_id: 'h' }, error: null } })
          : chain({ maybeSingle: { data: null, error: null } }) // household_members → not a member
      ),
    };
    mockServiceClient.mockReturnValue(admin as never);
    await expect(contributeToHouseholdGoal('u', 'g1', { amount: 50 })).rejects.toBeInstanceOf(NotHouseholdMemberError);
  });

  it('records the contribution, logs the Savings expense, and recomputes the total', async () => {
    const tables: Record<string, ReturnType<typeof chain>> = {
      goals: chain({ maybeSingle: { data: { id: 'g1', name: 'Vacation', household_id: 'h' }, error: null }, single: { data: { id: 'g1', current_amount: 150 }, error: null } }),
      household_members: chain({ maybeSingle: { data: { id: 'm' }, error: null } }),
      goal_contributions: chain({ single: { data: { id: 'gc1' }, error: null }, then: { data: [{ amount: 100 }, { amount: 50 }], error: null } }),
    };
    mockCreateClient.mockResolvedValue(authClient({ user_profiles: chain({ maybeSingle: { data: { preferences: { currency_format: 'EUR' } }, error: null } }) }) as never);
    mockServiceClient.mockReturnValue({ from: jest.fn((t: string) => tables[t] ?? chain({})) } as never);

    const result = await contributeToHouseholdGoal('u', 'g1', { amount: 50 });
    expect(mockLogSavings).toHaveBeenCalledTimes(1);
    expect(mockLogSavings.mock.calls[0]![1]).toMatchObject({ amount: 50, goalContributionId: 'gc1', goalName: 'Vacation' });
    expect((result as { current_amount: number }).current_amount).toBe(150);
    // recompute updated goals with SUM(100+50)=150
    expect((tables.goals!.update as jest.Mock)).toHaveBeenCalledWith({ current_amount: 150 });
  });
});

describe('getHouseholdGoals', () => {
  it('returns [] when the caller has no household', async () => {
    mockCreateClient.mockResolvedValue(authClient({ household_members: chain({ maybeSingle: { data: null, error: null } }) }) as never);
    expect(await getHouseholdGoals('u')).toEqual([]);
  });

  it('attaches the per-member breakdown to each goal', async () => {
    const GOAL = { id: 'g1', household_id: 'h', name: 'Vacation', target_amount: 1000, current_amount: 150 };
    const client = authClient(
      {
        household_members: chain({ maybeSingle: { data: { household_id: 'h' }, error: null } }),
        goals: chain({ then: { data: [GOAL], error: null } }),
      },
      { data: [{ user_id: 'u', email: 'a@x.test', contributed: 100 }], error: null }
    );
    mockCreateClient.mockResolvedValue(client as never);

    const result = await getHouseholdGoals('u');
    expect(result).toHaveLength(1);
    expect(result[0]!.goal).toEqual(GOAL);
    expect(result[0]!.breakdown).toEqual([{ user_id: 'u', email: 'a@x.test', contributed: 100 }]);
  });
});
