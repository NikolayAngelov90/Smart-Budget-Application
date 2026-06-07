/**
 * savingsTransactionService tests — Story 13.9
 * Logs a "Savings" expense for a goal contribution (creating the category if needed).
 */

jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { logSavingsContribution } from '@/lib/services/savingsTransactionService';

interface MockOpts {
  existingCategory?: { id: string } | null;
  createdCategory?: { id: string } | null;
}

let txInsertArg: Record<string, unknown> | null;
let categoryInsertCalled: boolean;

function makeClient({ existingCategory = null, createdCategory = { id: 'cat-new' } }: MockOpts) {
  txInsertArg = null;
  categoryInsertCalled = false;
  return {
    from: jest.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({ data: existingCategory, error: null }),
                })),
              })),
            })),
          })),
          insert: jest.fn(() => {
            categoryInsertCalled = true;
            return { select: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: createdCategory, error: null }) })) };
          }),
        };
      }
      // transactions
      return {
        insert: jest.fn((arg: Record<string, unknown>) => {
          txInsertArg = arg;
          return Promise.resolve({ error: null });
        }),
      };
    }),
  };
}

const base = { userId: 'u1', amount: 50, goalName: 'Vacation', goalContributionId: 'gc1', currency: 'EUR' };

beforeEach(() => jest.clearAllMocks());

it('creates the Savings category when missing, then logs the expense linked to the contribution', async () => {
  const client = makeClient({ existingCategory: null, createdCategory: { id: 'cat-new' } });
  await logSavingsContribution(client as never, base);
  expect(categoryInsertCalled).toBe(true);
  expect(txInsertArg?.category_id).toBe('cat-new');
  expect(txInsertArg?.type).toBe('expense');
  expect(txInsertArg?.goal_contribution_id).toBe('gc1');
  expect(txInsertArg?.household_id).toBeNull();
  expect(txInsertArg?.amount).toBe(50);
});

it('reuses an existing Savings category', async () => {
  const client = makeClient({ existingCategory: { id: 'cat-existing' } });
  await logSavingsContribution(client as never, base);
  expect(categoryInsertCalled).toBe(false);
  expect(txInsertArg?.category_id).toBe('cat-existing');
});
