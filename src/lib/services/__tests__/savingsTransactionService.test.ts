/**
 * savingsTransactionService tests — Story 13.9
 * Logs a "Savings" expense for a goal contribution (creating the category if needed).
 */

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { logSavingsContribution } from '@/lib/services/savingsTransactionService';

interface MockOpts {
  existingCategory?: { id: string } | null;
  createdCategory?: { id: string } | null;
}

/**
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled client nested a
 * select/eq/eq/eq/maybeSingle ladder for `categories` and captured the
 * transaction insert in a module-level variable. The factory records every
 * call instead, and its per-table QUEUE models the create path directly:
 * `categories` is queried twice there - the find, then the insert - so the
 * first chain answers the find and the second answers the create.
 *
 * CONTROL-ARM FILE: savingsTransactionService rethrows on both failure paths,
 * so a missing chain method would fail a test rather than be absorbed.
 */
function makeClient({ existingCategory = null, createdCategory = { id: 'cat-new' } }: MockOpts) {
  return createSupabaseMock({
    tables: {
      categories: [
        { data: existingCategory, error: null },
        { data: createdCategory, error: null },
      ],
      transactions: { data: null, error: null },
    },
  });
}

/** The single transaction row the service inserted. */
const txInsert = (db: ReturnType<typeof makeClient>) =>
  db.callsTo('transactions', 'insert')[0]![0] as Record<string, unknown>;

/** Whether the create branch ran - insert calls across EVERY categories chain. */
const categoryInserted = (db: ReturnType<typeof makeClient>) =>
  db.allCallsTo('categories', 'insert').length > 0;

const base = {
  userId: 'u1',
  amount: 50,
  goalName: 'Vacation',
  goalContributionId: 'gc1',
  currency: 'EUR',
};

beforeEach(() => jest.clearAllMocks());

it('creates the Savings category when missing, then logs the expense linked to the contribution', async () => {
  const db = makeClient({ existingCategory: null, createdCategory: { id: 'cat-new' } });
  await logSavingsContribution(db.client, base);
  expect(categoryInserted(db)).toBe(true);
  expect(txInsert(db).category_id).toBe('cat-new');
  expect(txInsert(db).type).toBe('expense');
  expect(txInsert(db).goal_contribution_id).toBe('gc1');
  expect(txInsert(db).household_id).toBeNull();
  expect(txInsert(db).amount).toBe(50);
});

it('reuses an existing Savings category', async () => {
  const db = makeClient({ existingCategory: { id: 'cat-existing' } });
  await logSavingsContribution(db.client, base);
  expect(categoryInserted(db)).toBe(false);
  expect(txInsert(db).category_id).toBe('cat-existing');
});
