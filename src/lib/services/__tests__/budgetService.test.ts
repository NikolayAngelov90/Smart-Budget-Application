/**
 * budgetService tests — ADR-025
 * Mocked Supabase (service boundary). Owner-only RLS is the production gate
 * (migration 032); service behavior is what's covered here.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  listBudgets,
  upsertBudget,
  deleteBudget,
  BudgetNotFoundError,
  CategoryNotBudgetableError,
} from '@/lib/services/budgetService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
}

/** A chainable query stub: every method returns `this`; terminals + await resolve to `result`. */
function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'is', 'insert', 'update', 'delete']) {
    bag[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>;

/** Builds a client whose `from(table)` consumes the next queued result for that table. */
function makeClient(plan: Plan) {
  const queues: Record<string, { data: unknown; error: unknown }[] | { data: unknown; error: unknown }> = {};
  for (const [k, v] of Object.entries(plan)) queues[k] = Array.isArray(v) ? [...v] : v;
  const from = jest.fn((table: string) => {
    const q = queues[table];
    let result: { data: unknown; error: unknown } = { data: null, error: null };
    if (Array.isArray(q)) result = q.length ? q.shift()! : { data: null, error: null };
    else if (q) result = q;
    return chain(result);
  });
  return { from };
}

const BUDGET_ROW = {
  id: 'b-1',
  user_id: 'u-1',
  household_id: null,
  category_id: 'cat-1',
  period: 'monthly',
  limit_amount: 300,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('listBudgets', () => {
  it('returns the user personal budget rows', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: [BUDGET_ROW], error: null } }) as never
    );
    const result = await listBudgets('u-1');
    expect(result).toEqual([BUDGET_ROW]);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: null, error: { message: 'boom' } } }) as never
    );
    await expect(listBudgets('u-1')).rejects.toThrow('Failed to load budgets');
  });
});

describe('upsertBudget', () => {
  it('rejects a category the user does not own (404 semantics)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ categories: { data: null, error: null } }) as never
    );
    await expect(upsertBudget('u-1', 'cat-x', 100)).rejects.toBeInstanceOf(BudgetNotFoundError);
  });

  it('rejects income categories', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'income' }, error: null },
      }) as never
    );
    await expect(upsertBudget('u-1', 'cat-1', 100)).rejects.toBeInstanceOf(
      CategoryNotBudgetableError
    );
  });

  it('inserts a new budget when none exists', async () => {
    const client = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: null, error: null }, // existing lookup → none
        { data: BUDGET_ROW, error: null }, // insert result
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await upsertBudget('u-1', 'cat-1', 300);
    expect(result).toEqual(BUDGET_ROW);
    // Third from() call is the insert chain
    const budgetChains = client.from.mock.results
      .filter((_, i) => client.from.mock.calls[i]?.[0] === 'category_budgets')
      .map((r) => r.value as ChainStub);
    expect(budgetChains[1]!.insert).toHaveBeenCalledWith({
      user_id: 'u-1',
      category_id: 'cat-1',
      period: 'monthly',
      limit_amount: 300,
    });
  });

  it('recovers from a 23505 insert race by updating the winner row', async () => {
    const client = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: null, error: null }, // existing lookup → none (stale: raced)
        { data: null, error: { code: '23505', message: 'duplicate key' } }, // insert loses
        { data: { ...BUDGET_ROW, limit_amount: 275 }, error: null }, // recovery update
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await upsertBudget('u-1', 'cat-1', 275);
    expect(result.limit_amount).toBe(275);
  });

  it('updates the existing budget row when one exists', async () => {
    const updated = { ...BUDGET_ROW, limit_amount: 450 };
    const client = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: { id: 'b-1' }, error: null }, // existing lookup → found
        { data: updated, error: null }, // update result
      ],
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await upsertBudget('u-1', 'cat-1', 450);
    expect(result.limit_amount).toBe(450);
    const budgetChains = client.from.mock.results
      .filter((_, i) => client.from.mock.calls[i]?.[0] === 'category_budgets')
      .map((r) => r.value as ChainStub);
    expect(budgetChains[1]!.update).toHaveBeenCalledWith({ limit_amount: 450 });
  });
});

describe('deleteBudget', () => {
  it('deletes an owned budget', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: [{ id: 'b-1' }], error: null } }) as never
    );
    await expect(deleteBudget('u-1', 'b-1')).resolves.toBeUndefined();
  });

  it('throws BudgetNotFoundError when no row was deleted (not owned / unknown)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: [], error: null } }) as never
    );
    await expect(deleteBudget('u-1', 'b-x')).rejects.toBeInstanceOf(BudgetNotFoundError);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: null, error: { message: 'boom' } } }) as never
    );
    await expect(deleteBudget('u-1', 'b-1')).rejects.toThrow('Failed to delete budget');
  });
});
