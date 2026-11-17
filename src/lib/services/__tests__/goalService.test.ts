/**
 * Goal Service Tests
 * Story 11.5: Savings Goals
 *
 * Task 10.1: Unit tests for goalService.ts
 * - getGoals: returns list, throws on error
 * - getGoal: returns single goal, returns null when not found, throws on error
 * - createGoal: inserts correct fields, returns created goal, throws on error
 * - updateGoal: updates correctly, throws when not found, throws on error
 * - deleteGoal: deletes with ownership filter, throws on error
 * - addContribution: inserts contribution, increments current_amount, throws on errors
 */

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  markMilestoneCelebrated,
} from '../goalService';

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * ONE CLIENT BUILDER, replacing three hand-rolled chain helpers.
 *
 * Each of the three listed the methods one call path happened to use on the day
 * it was written: an `.order()` terminal for getGoals, `.single()` for
 * getGoal/createGoal/updateGoal, and — worst of the three — a POSITIONAL `.eq()`
 * for deleteGoal whose first call returned the chain and whose second RESOLVED.
 * That is the unconsumed-`...Once` shape this repo has been bitten by twice: the
 * chain's behaviour depended on how many times `eq` had been called, so adding a
 * filter to the production query silently changed which call resolved.
 *
 * `createSupabaseMock` is chainable at any depth and thenable at any terminal,
 * so none of that is encoded here any more. Assertions are unchanged: the shared
 * chain answers each method with a memoised `jest.fn`, precisely so
 * `expect(db.chainFor('goals').eq).toHaveBeenCalledWith(...)` keeps working.
 *
 * An ARRAY is a queue consumed in `from()` order, which is how a service that
 * queries the same table twice behaves.
 */
const goalsClient = (result: unknown) => createSupabaseMock({ tables: { goals: result as never } });

// ============================================================================
// SAMPLE DATA
// ============================================================================

const sampleGoal = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Emergency Fund',
  target_amount: 1000,
  current_amount: 250,
  deadline: null,
  milestones_celebrated: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// getGoals
// ============================================================================

describe('getGoals', () => {
  it('returns empty array when user has no goals', async () => {
    const db = goalsClient({ data: [], error: null });
    const supabase = db.client as Parameters<typeof getGoals>[0];

    const result = await getGoals(supabase, 'user-1');
    expect(result).toEqual([]);
    expect(db.chainFor('goals').order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns goals array when goals exist', async () => {
    const db = goalsClient({ data: [sampleGoal], error: null });
    const supabase = db.client as Parameters<typeof getGoals>[0];

    const result = await getGoals(supabase, 'user-1');
    expect(result).toEqual([sampleGoal]);
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Connection refused');
    const db = goalsClient({ data: null, error: dbError });
    const supabase = db.client as Parameters<typeof getGoals>[0];

    await expect(getGoals(supabase, 'user-1')).rejects.toThrow('Connection refused');
  });
});

// ============================================================================
// getGoal
// ============================================================================

describe('getGoal', () => {
  it('returns goal when found', async () => {
    const db = goalsClient({ data: sampleGoal, error: null });
    const supabase = db.client as Parameters<typeof getGoal>[0];

    const result = await getGoal(supabase, 'user-1', 'goal-1');
    expect(result).toEqual(sampleGoal);
  });

  it('returns null when goal not found (PGRST116)', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const db = goalsClient({ data: null, error: notFoundError });
    const supabase = db.client as Parameters<typeof getGoal>[0];

    const result = await getGoal(supabase, 'user-1', 'nonexistent');
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 DB error', async () => {
    const dbError = new Error('Query failed');
    const db = goalsClient({ data: null, error: dbError });
    const supabase = db.client as Parameters<typeof getGoal>[0];

    await expect(getGoal(supabase, 'user-1', 'goal-1')).rejects.toThrow('Query failed');
  });
});

// ============================================================================
// createGoal
// ============================================================================

describe('createGoal', () => {
  it('inserts correct fields and returns created goal', async () => {
    const db = goalsClient({ data: sampleGoal, error: null });
    const supabase = db.client as Parameters<typeof createGoal>[0];

    const result = await createGoal(supabase, 'user-1', {
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: null,
    });

    expect(result).toEqual(sampleGoal);
    expect(db.chainFor('goals').insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: null,
    });
  });

  it('passes deadline when provided', async () => {
    const goalWithDeadline = { ...sampleGoal, deadline: '2027-01-01' };
    const db = goalsClient({ data: goalWithDeadline, error: null });
    const supabase = db.client as Parameters<typeof createGoal>[0];

    await createGoal(supabase, 'user-1', {
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: '2027-01-01',
    });

    expect(db.chainFor('goals').insert).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: '2027-01-01' })
    );
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Insert failed');
    const db = goalsClient({ data: null, error: dbError });
    const supabase = db.client as Parameters<typeof createGoal>[0];

    await expect(
      createGoal(supabase, 'user-1', { name: 'Test', target_amount: 100 })
    ).rejects.toThrow('Insert failed');
  });
});

// ============================================================================
// updateGoal
// ============================================================================

describe('updateGoal', () => {
  it('updates goal and returns updated data', async () => {
    const updatedGoal = { ...sampleGoal, name: 'Updated Name' };
    const db = goalsClient({ data: updatedGoal, error: null });
    const supabase = db.client as Parameters<typeof updateGoal>[0];

    const result = await updateGoal(supabase, 'user-1', 'goal-1', { name: 'Updated Name' });
    expect(result).toEqual(updatedGoal);
    expect(db.chainFor('goals').update).toHaveBeenCalledWith({ name: 'Updated Name' });
    expect(db.chainFor('goals').eq).toHaveBeenCalledWith('id', 'goal-1');
    expect(db.chainFor('goals').eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws "Goal not found" when PGRST116 returned', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const db = goalsClient({ data: null, error: notFoundError });
    const supabase = db.client as Parameters<typeof updateGoal>[0];

    await expect(updateGoal(supabase, 'user-1', 'nonexistent', { name: 'New' })).rejects.toThrow(
      'Goal not found'
    );
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Update failed');
    const db = goalsClient({ data: null, error: dbError });
    const supabase = db.client as Parameters<typeof updateGoal>[0];

    await expect(updateGoal(supabase, 'user-1', 'goal-1', { name: 'New' })).rejects.toThrow(
      'Update failed'
    );
  });
});

// ============================================================================
// deleteGoal
// ============================================================================

describe('deleteGoal', () => {
  it('calls delete with correct ownership filters', async () => {
    const db = goalsClient({ error: null });
    const supabase = db.client as Parameters<typeof deleteGoal>[0];

    await deleteGoal(supabase, 'user-1', 'goal-1');
    expect(db.chainFor('goals').delete).toHaveBeenCalled();
    expect(db.chainFor('goals').eq).toHaveBeenCalledWith('id', 'goal-1');
    expect(db.chainFor('goals').eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Delete failed');
    const db = goalsClient({ error: dbError });
    const supabase = db.client as Parameters<typeof deleteGoal>[0];

    await expect(deleteGoal(supabase, 'user-1', 'goal-1')).rejects.toThrow('Delete failed');
  });
});

// ============================================================================
// addContribution
// ============================================================================

describe('addContribution', () => {
  function buildAddContribMock(
    insertResult: { error: Error | null },
    fetchResult: {
      data: { current_amount: number } | null;
      error: Error | { code: string } | null;
    },
    updateResult: { data: typeof sampleGoal | null; error: Error | null }
  ) {
    // PER-TABLE RESULTS, replacing a POSITIONAL mock that answered by COUNT:
    // call 1 was the contributions insert, call 2 the goals select, and call 3+
    // fell through to the goals update. The service makes a FOURTH call -
    // `from('user_profiles').select('preferences').eq('id', userId).maybeSingle()`
    // - which landed on the update chain, which has no `maybeSingle`, so it threw
    // TypeError. That throw is absorbed by a deliberate non-fatal catch in
    // goalService, so no assertion ever saw it and Story 13.9's savings-expense
    // logging has never executed in any test.
    //
    // `goals: [fetchResult, updateResult]` is a QUEUE consumed in from() order,
    // which is what the count-based mock was approximating by hand.
    return createSupabaseMock({
      tables: {
        goal_contributions: {
          data: insertResult.error ? null : { id: 'contrib-1' },
          error: insertResult.error,
        },
        goals: [fetchResult as never, updateResult as never],
      },
    }).client as Parameters<typeof addContribution>[0];
  }

  it('inserts contribution and returns goal with updated current_amount', async () => {
    const updatedGoal = { ...sampleGoal, current_amount: 350 };
    const supabase = buildAddContribMock(
      { error: null },
      { data: { current_amount: 250 }, error: null },
      { data: updatedGoal, error: null }
    );

    const result = await addContribution(supabase, 'user-1', 'goal-1', { amount: 100 });
    expect(result.current_amount).toBe(350);
  });

  it('throws when insert contribution fails', async () => {
    const dbError = new Error('Insert failed');
    const supabase = buildAddContribMock(
      { error: dbError },
      { data: null, error: null },
      { data: null, error: null }
    );

    await expect(addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })).rejects.toThrow(
      'Insert failed'
    );
  });

  it('throws "Goal not found" when fetch after insert returns PGRST116', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const supabase = buildAddContribMock(
      { error: null },
      { data: null, error: notFoundError },
      { data: null, error: null }
    );

    await expect(addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })).rejects.toThrow(
      'Goal not found'
    );
  });

  it('throws when goal update fails', async () => {
    const updateError = new Error('Update failed');
    const supabase = buildAddContribMock(
      { error: null },
      { data: { current_amount: 250 }, error: null },
      { data: null, error: updateError }
    );

    await expect(addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })).rejects.toThrow(
      'Update failed'
    );
  });
});

// ============================================================================
// markMilestoneCelebrated
// ============================================================================

describe('addContribution — the savings-expense SEAM (Story 13.9)', () => {
  /**
   * THE FIRST TESTS TO EXERCISE THIS SEAM, and worth stating precisely because
   * the first attempt at stating it was wrong.
   *
   * `logSavingsContribution` itself is NOT untested — savingsTransactionService
   * .test.ts has covered it since the story shipped, both the create-the-category
   * and reuse-an-existing-one branches. The claim that "Story 13.9's logging has
   * never executed in any test" was an absence inferred from a failure, and the
   * paired check was one `ls`.
   *
   * What has never run is the SEAM: addContribution reading the contributor's
   * `preferences.currency_format`, resolving a currency, and passing it with the
   * GOAL'S NAME to the logger. The old positional mock threw
   * `TypeError: ... maybeSingle is not a function` on exactly the step the unit
   * test skips - the profile lookup - so the seam died before the call, and
   * production's non-fatal catch absorbed it. Both values are user-visible in the
   * ledger entry, and neither was checked anywhere.
   *
   * These tests are reachable only because the shared chain mock stopped
   * throwing. The migration did not FIND the gap - the logged error did - but it
   * is what made the gap testable.
   *
   * WHAT THESE DELIBERATELY DO NOT ASSERT: anything about `current_amount`.
   * `goals.current_amount`, `goals.target_amount` and `goal_contributions.amount`
   * are all unitless - there is no currency column on either table - so goal
   * progress is raw addition over amounts that may be in different currencies.
   * Pinning the ledger entry's currency while the accumulator is unitless would
   * pin half of a broken pair. See the board item in deferred-work.md.
   */
  const SAVINGS_CATEGORY = 'cat-savings';

  function contribMock(opts: { currencyFormat?: unknown; goalName?: string } = {}) {
    const { currencyFormat, goalName = 'Holiday' } = opts;
    return createSupabaseMock({
      tables: {
        goal_contributions: { data: { id: 'contrib-1' }, error: null },
        goals: [
          { data: { current_amount: 250, name: goalName }, error: null },
          { data: { ...sampleGoal, name: goalName, current_amount: 300 }, error: null },
        ],
        user_profiles: {
          data:
            currencyFormat === undefined
              ? {}
              : { preferences: { currency_format: currencyFormat } },
          error: null,
        },
        categories: { data: { id: SAVINGS_CATEGORY }, error: null },
        transactions: { data: null, error: null },
      },
    });
  }

  it("logs the expense in the CONTRIBUTOR'S currency, not the default", async () => {
    const db = contribMock({ currencyFormat: 'USD' });

    await addContribution(db.client as Parameters<typeof addContribution>[0], 'user-1', 'goal-1', {
      amount: 50,
    } as never);

    // The whole point of the profile lookup. Before this test nothing checked
    // that the resolved currency reached the row.
    const inserted = db.callsTo('transactions', 'insert')[0]![0] as Record<string, unknown>;
    expect(inserted.currency).toBe('USD');
    expect(inserted.goal_contribution_id).toBe('contrib-1');
    expect(inserted.type).toBe('expense');
    expect(inserted.amount).toBe(50);
  });

  it("carries the GOAL'S NAME into the notes, which the user reads in the ledger", async () => {
    const db = contribMock({ currencyFormat: 'EUR', goalName: 'New Roof' });

    await addContribution(db.client as Parameters<typeof addContribution>[0], 'user-1', 'goal-1', {
      amount: 25,
    } as never);

    const inserted = db.callsTo('transactions', 'insert')[0]![0] as Record<string, unknown>;
    expect(inserted.notes).toBe('Savings: New Roof');
  });

  it('falls back to the default currency when the profile has no preference', async () => {
    const db = contribMock({});

    await addContribution(db.client as Parameters<typeof addContribution>[0], 'user-1', 'goal-1', {
      amount: 10,
    } as never);

    const inserted = db.callsTo('transactions', 'insert')[0]![0] as Record<string, unknown>;
    expect(inserted.currency).toBe('EUR');
  });

  it('scopes the profile lookup to the contributor', async () => {
    const db = contribMock({ currencyFormat: 'GBP' });

    await addContribution(db.client as Parameters<typeof addContribution>[0], 'user-1', 'goal-1', {
      amount: 10,
    } as never);

    // An arg-blind stub is how a dropped user scope stays green - the repo's
    // documented 3x-recurring bug, and this lookup is one `eq` away from
    // reading somebody else's currency.
    expect(db.callsTo('user_profiles', 'eq')).toContainEqual(['id', 'user-1']);
  });

  it('the contribution still succeeds when the savings logging fails', async () => {
    // The non-fatal contract, asserted rather than assumed. `categories`
    // resolving to no row sends resolveSavingsCategoryId down its create
    // branch, which then also finds nothing and throws.
    const db = createSupabaseMock({
      tables: {
        goal_contributions: { data: { id: 'contrib-1' }, error: null },
        goals: [
          { data: { current_amount: 250, name: 'Holiday' }, error: null },
          { data: sampleGoal, error: null },
        ],
        user_profiles: { data: {}, error: null },
        categories: { data: null, error: null },
      },
    });

    await expect(
      addContribution(db.client as Parameters<typeof addContribution>[0], 'user-1', 'goal-1', {
        amount: 50,
      } as never)
    ).resolves.toEqual(sampleGoal);

    // AND NOTHING WAS WRITTEN. `callsTo('transactions', ...)` is the wrong
    // idiom here and the factory says so: it THROWS when asked about a table
    // nobody queried rather than returning `[]`, which is the pairing rule
    // implemented in the mock - it refuses to answer an absence question with a
    // shape that fails open.
    //
    // So the absence is asserted on `from`, PAIRED with a presence that proves
    // the savings path ran at all. Without the pair, "never wrote to
    // transactions" would also be satisfied by the path never starting.
    expect(db.from).toHaveBeenCalledWith('categories');
    expect(db.from).not.toHaveBeenCalledWith('transactions');
  });
});

describe('markMilestoneCelebrated', () => {
  /**
   * Builds a mock that:
   *  - fromCall 1: SELECT .select().eq().eq().single() → fetchResult
   *  - fromCall 2: UPDATE .update().eq().eq() → updateResult
   *
   * Returns { supabase, updateChain } so tests can assert on UPDATE payload
   * and ownership filter (M2: security regression guard).
   */
  function buildMarkMilestoneMock(
    fetchResult: {
      data: { milestones_celebrated: number[] } | null;
      error: { code?: string; message?: string } | null;
    },
    updateResult: { error: { message: string } | null }
  ) {
    // Two calls to the same table, so a QUEUE rather than a counter. The old
    // mock also used `eq: mockReturnValueOnce(chain).mockResolvedValueOnce(...)`,
    // whose behaviour depended on HOW MANY TIMES eq had been called - adding an
    // ownership filter to the production query would silently have changed which
    // call resolved.
    const db = createSupabaseMock({
      tables: { goals: [fetchResult as never, updateResult as never] },
    });
    return {
      supabase: db.client as Parameters<typeof markMilestoneCelebrated>[0],
      db,
    };
  }

  it('appends threshold and calls update with correct payload and ownership filter', async () => {
    const { supabase, db } = buildMarkMilestoneMock(
      { data: { milestones_celebrated: [25] }, error: null },
      { error: null }
    );

    await markMilestoneCelebrated(supabase, 'user-1', 'goal-1', 50);

    expect(supabase.from).toHaveBeenCalledTimes(2);
    // M2: verify correct merged array is written
    expect(db.chainFor('goals', 1).update).toHaveBeenCalledWith({
      milestones_celebrated: [25, 50],
    });
    // M2: verify ownership filter present on UPDATE (prevents cross-user writes)
    expect(db.chainFor('goals', 1).eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('is a no-op when threshold already in milestones_celebrated', async () => {
    const { supabase } = buildMarkMilestoneMock(
      { data: { milestones_celebrated: [25, 50] }, error: null },
      { error: null }
    );

    await markMilestoneCelebrated(supabase, 'user-1', 'goal-1', 50);
    // Only SELECT called, no UPDATE
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('returns silently on PGRST116 (goal deleted race condition)', async () => {
    const { supabase } = buildMarkMilestoneMock(
      { data: null, error: { code: 'PGRST116', message: 'Row not found' } },
      { error: null }
    );

    await expect(
      markMilestoneCelebrated(supabase, 'user-1', 'deleted-goal', 25)
    ).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('throws on non-PGRST116 fetch error', async () => {
    const { supabase } = buildMarkMilestoneMock(
      { data: null, error: { message: 'DB connection lost' } },
      { error: null }
    );

    await expect(markMilestoneCelebrated(supabase, 'user-1', 'goal-1', 25)).rejects.toMatchObject({
      message: 'DB connection lost',
    });
  });

  it('throws when UPDATE call fails', async () => {
    const { supabase } = buildMarkMilestoneMock(
      { data: { milestones_celebrated: [25] }, error: null },
      { error: { message: 'Write failed' } }
    );

    await expect(markMilestoneCelebrated(supabase, 'user-1', 'goal-1', 50)).rejects.toMatchObject({
      message: 'Write failed',
    });
  });
});
