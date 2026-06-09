/**
 * categoryShareService tests — Story 13.5 follow-up (share existing/default categories)
 */

jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { createServiceRoleClient } from '@/lib/supabase/server';
import { setCategoryShared, CategoryNotFoundError } from '@/lib/services/categoryShareService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;

let updateArg: Record<string, unknown> | null;

function adminClient(opts: { category?: object | null; householdId?: string | null; updated?: object }) {
  const { category = { id: 'c1', user_id: 'u1' }, householdId = 'h-1', updated = { id: 'c1', household_id: 'h-1' } } = opts;
  updateArg = null;
  return {
    from: jest.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: category, error: null }),
          update: jest.fn((arg: Record<string, unknown>) => {
            updateArg = arg;
            return { eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: updated, error: null }) };
          }),
        };
      }
      // household_members
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: householdId ? { household_id: householdId } : null, error: null }),
      };
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

it('shares a category by setting household_id (works for the caller’s own category)', async () => {
  mockServiceClient.mockReturnValue(adminClient({}) as never);
  await setCategoryShared('u1', 'c1', true);
  expect(updateArg).toEqual({ household_id: 'h-1' });
});

it('un-shares a category by clearing household_id (no membership lookup needed)', async () => {
  mockServiceClient.mockReturnValue(adminClient({ updated: { id: 'c1', household_id: null } }) as never);
  await setCategoryShared('u1', 'c1', false);
  expect(updateArg).toEqual({ household_id: null });
});

it('throws CategoryNotFoundError when the category is not the caller’s', async () => {
  mockServiceClient.mockReturnValue(adminClient({ category: { id: 'c1', user_id: 'someone-else' } }) as never);
  await expect(setCategoryShared('u1', 'c1', true)).rejects.toBeInstanceOf(CategoryNotFoundError);
});

it('throws NotHouseholdMemberError when sharing without a household', async () => {
  mockServiceClient.mockReturnValue(adminClient({ householdId: null }) as never);
  await expect(setCategoryShared('u1', 'c1', true)).rejects.toBeInstanceOf(NotHouseholdMemberError);
});
