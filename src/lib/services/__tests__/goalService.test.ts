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

import {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
} from '../goalService';

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Creates a chainable Supabase mock ending at .order() (terminal).
 * Used for getGoals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createOrderChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockResolvedValue(resolveWith);
  return chain;
}

/**
 * Creates a chainable Supabase mock ending at .single() (terminal).
 * Used for getGoal, createGoal (after select), updateGoal (after select).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSingleChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(resolveWith);
  return chain;
}

/**
 * Creates a chainable mock ending at the second .eq() after .delete() (terminal).
 * Used for deleteGoal which ends at `.delete().eq().eq()` resolving the query.
 * First .eq() returns the chain; second .eq() resolves with the result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDeleteChainMock(resolveWith: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn()
    .mockReturnValueOnce(chain)
    .mockResolvedValueOnce(resolveWith);
  return chain;
}

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
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ============================================================================
// getGoals
// ============================================================================

describe('getGoals', () => {
  it('returns empty array when user has no goals', async () => {
    const chain = createOrderChainMock({ data: [], error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoals>[0];

    const result = await getGoals(supabase, 'user-1');
    expect(result).toEqual([]);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns goals array when goals exist', async () => {
    const chain = createOrderChainMock({ data: [sampleGoal], error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoals>[0];

    const result = await getGoals(supabase, 'user-1');
    expect(result).toEqual([sampleGoal]);
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Connection refused');
    const chain = createOrderChainMock({ data: null, error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoals>[0];

    await expect(getGoals(supabase, 'user-1')).rejects.toThrow('Connection refused');
  });
});

// ============================================================================
// getGoal
// ============================================================================

describe('getGoal', () => {
  it('returns goal when found', async () => {
    const chain = createSingleChainMock({ data: sampleGoal, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoal>[0];

    const result = await getGoal(supabase, 'user-1', 'goal-1');
    expect(result).toEqual(sampleGoal);
  });

  it('returns null when goal not found (PGRST116)', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const chain = createSingleChainMock({ data: null, error: notFoundError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoal>[0];

    const result = await getGoal(supabase, 'user-1', 'nonexistent');
    expect(result).toBeNull();
  });

  it('throws on non-PGRST116 DB error', async () => {
    const dbError = new Error('Query failed');
    const chain = createSingleChainMock({ data: null, error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof getGoal>[0];

    await expect(getGoal(supabase, 'user-1', 'goal-1')).rejects.toThrow('Query failed');
  });
});

// ============================================================================
// createGoal
// ============================================================================

describe('createGoal', () => {
  it('inserts correct fields and returns created goal', async () => {
    const chain = createSingleChainMock({ data: sampleGoal, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof createGoal>[0];

    const result = await createGoal(supabase, 'user-1', {
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: null,
    });

    expect(result).toEqual(sampleGoal);
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: null,
    });
  });

  it('passes deadline when provided', async () => {
    const goalWithDeadline = { ...sampleGoal, deadline: '2027-01-01' };
    const chain = createSingleChainMock({ data: goalWithDeadline, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof createGoal>[0];

    await createGoal(supabase, 'user-1', {
      name: 'Emergency Fund',
      target_amount: 1000,
      deadline: '2027-01-01',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: '2027-01-01' })
    );
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Insert failed');
    const chain = createSingleChainMock({ data: null, error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof createGoal>[0];

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
    const chain = createSingleChainMock({ data: updatedGoal, error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof updateGoal>[0];

    const result = await updateGoal(supabase, 'user-1', 'goal-1', { name: 'Updated Name' });
    expect(result).toEqual(updatedGoal);
    expect(chain.update).toHaveBeenCalledWith({ name: 'Updated Name' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'goal-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws "Goal not found" when PGRST116 returned', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const chain = createSingleChainMock({ data: null, error: notFoundError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof updateGoal>[0];

    await expect(
      updateGoal(supabase, 'user-1', 'nonexistent', { name: 'New' })
    ).rejects.toThrow('Goal not found');
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Update failed');
    const chain = createSingleChainMock({ data: null, error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof updateGoal>[0];

    await expect(
      updateGoal(supabase, 'user-1', 'goal-1', { name: 'New' })
    ).rejects.toThrow('Update failed');
  });
});

// ============================================================================
// deleteGoal
// ============================================================================

describe('deleteGoal', () => {
  it('calls delete with correct ownership filters', async () => {
    const chain = createDeleteChainMock({ error: null });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof deleteGoal>[0];

    await deleteGoal(supabase, 'user-1', 'goal-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'goal-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws on DB error', async () => {
    const dbError = new Error('Delete failed');
    const chain = createDeleteChainMock({ error: dbError });
    const supabase = { from: jest.fn().mockReturnValue(chain) } as unknown as Parameters<typeof deleteGoal>[0];

    await expect(deleteGoal(supabase, 'user-1', 'goal-1')).rejects.toThrow('Delete failed');
  });
});

// ============================================================================
// addContribution
// ============================================================================

describe('addContribution', () => {
  function buildAddContribMock(
    insertResult: { error: Error | null },
    fetchResult: { data: { current_amount: number } | null; error: Error | { code: string } | null },
    updateResult: { data: typeof sampleGoal | null; error: Error | null }
  ) {
    let fromCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = {
      from: jest.fn().mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // goal_contributions INSERT
          return { insert: jest.fn().mockResolvedValue(insertResult) };
        }
        if (fromCallCount === 2) {
          // goals SELECT current_amount
          const fetchChain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue(fetchResult),
          };
          return fetchChain;
        }
        // goals UPDATE
        const updateChain = {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(updateResult),
        };
        return updateChain;
      }),
    };
    return supabase as Parameters<typeof addContribution>[0];
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

    await expect(
      addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })
    ).rejects.toThrow('Insert failed');
  });

  it('throws "Goal not found" when fetch after insert returns PGRST116', async () => {
    const notFoundError = { code: 'PGRST116', message: 'Row not found' };
    const supabase = buildAddContribMock(
      { error: null },
      { data: null, error: notFoundError },
      { data: null, error: null }
    );

    await expect(
      addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })
    ).rejects.toThrow('Goal not found');
  });

  it('throws when goal update fails', async () => {
    const updateError = new Error('Update failed');
    const supabase = buildAddContribMock(
      { error: null },
      { data: { current_amount: 250 }, error: null },
      { data: null, error: updateError }
    );

    await expect(
      addContribution(supabase, 'user-1', 'goal-1', { amount: 50 })
    ).rejects.toThrow('Update failed');
  });
});
