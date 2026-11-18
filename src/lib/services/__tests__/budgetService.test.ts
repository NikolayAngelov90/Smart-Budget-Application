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
import { createSupabaseMock } from '@/test-utils/supabaseChain';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

/*
 * MIGRATED to `@/test-utils/supabaseChain`. This file carried its own copy of a
 * per-table `makeClient` - the SAME builder hand-copied into budgetService,
 * streakService, valuesService and wishlistService tests, never extracted. It
 * already had the factory's queue model (per table, consumed in from() order);
 * what it lacked was method coverage: a fixed list of stubbed methods, so a
 * query using any other method threw a TypeError.
 *
 * Two semantic differences, stated rather than hidden: a queue that runs DRY
 * returned { data: null } there and repeats its last entry here; an unlisted
 * table returned { data: null } there and { data: [] } here (null for
 * single/maybeSingle). The tests passed unchanged across both.
 *
 * CONTROL-ARM FILE: budgetService has no catch at all, so a mock gap here fails
 * visibly. It was missed by the original census, which matched only
 * `from: jest.fn(` and not `const from = jest.fn(`.
 */
type Result = { data: unknown; error: unknown };
type Plan = Record<string, Result | Result[]>;

function makeClient(plan: Plan) {
  return createSupabaseMock({ tables: plan as never });
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
      makeClient({ category_budgets: { data: [BUDGET_ROW], error: null } }).client as never
    );
    const result = await listBudgets('u-1');
    expect(result).toEqual([BUDGET_ROW]);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: null, error: { message: 'boom' } } }).client as never
    );
    await expect(listBudgets('u-1')).rejects.toThrow('Failed to load budgets');
  });
});

describe('upsertBudget', () => {
  it('rejects a category the user does not own (404 semantics)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ categories: { data: null, error: null } }).client as never
    );
    await expect(upsertBudget('u-1', 'cat-x', 100)).rejects.toBeInstanceOf(BudgetNotFoundError);
  });

  it('rejects income categories', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'income' }, error: null },
      }).client as never
    );
    await expect(upsertBudget('u-1', 'cat-1', 100)).rejects.toBeInstanceOf(
      CategoryNotBudgetableError
    );
  });

  it('inserts a new budget when none exists', async () => {
    const db = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: null, error: null }, // existing lookup → none
        { data: BUDGET_ROW, error: null }, // insert result
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await upsertBudget('u-1', 'cat-1', 300);
    expect(result).toEqual(BUDGET_ROW);
    // The second category_budgets chain is the insert.
    expect(db.chainFor('category_budgets', 1).insert).toHaveBeenCalledWith({
      user_id: 'u-1',
      category_id: 'cat-1',
      period: 'monthly',
      limit_amount: 300,
    });
  });

  it('recovers from a 23505 insert race by updating the winner row', async () => {
    const db = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: null, error: null }, // existing lookup → none (stale: raced)
        { data: null, error: { code: '23505', message: 'duplicate key' } }, // insert loses
        { data: { ...BUDGET_ROW, limit_amount: 275 }, error: null }, // recovery update
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await upsertBudget('u-1', 'cat-1', 275);
    expect(result.limit_amount).toBe(275);
  });

  it('updates the existing budget row when one exists', async () => {
    const updated = { ...BUDGET_ROW, limit_amount: 450 };
    const db = makeClient({
      categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
      category_budgets: [
        { data: { id: 'b-1' }, error: null }, // existing lookup → found
        { data: updated, error: null }, // update result
      ],
    });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await upsertBudget('u-1', 'cat-1', 450);
    expect(result.limit_amount).toBe(450);
    expect(db.chainFor('category_budgets', 1).update).toHaveBeenCalledWith({ limit_amount: 450 });
  });
});

describe('deleteBudget', () => {
  it('deletes an owned budget', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: [{ id: 'b-1' }], error: null } }).client as never
    );
    await expect(deleteBudget('u-1', 'b-1')).resolves.toBeUndefined();
  });

  it('throws BudgetNotFoundError when no row was deleted (not owned / unknown)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: [], error: null } }).client as never
    );
    await expect(deleteBudget('u-1', 'b-x')).rejects.toBeInstanceOf(BudgetNotFoundError);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ category_budgets: { data: null, error: { message: 'boom' } } }).client as never
    );
    await expect(deleteBudget('u-1', 'b-1')).rejects.toThrow('Failed to delete budget');
  });
});
