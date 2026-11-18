/**
 * categoryShareService tests — Story 13.5 follow-up (share existing/default categories)
 */

jest.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { setCategoryShared, CategoryNotFoundError } from '@/lib/services/categoryShareService';
import { NotHouseholdMemberError } from '@/lib/services/householdService';

const mockServiceClient = createServiceRoleClient as jest.MockedFunction<
  typeof createServiceRoleClient
>;

/**
 * MIGRATED to `@/test-utils/supabaseChain`. The hand-rolled client captured the
 * update payload in a module-level `updateArg`; the factory records it.
 * `categories` is queried twice - the ownership lookup, then the update - so a
 * two-entry queue.
 *
 * CONTROL-ARM FILE: categoryShareService throws typed errors, nothing swallowed.
 */
function adminClient(opts: {
  category?: object | null;
  householdId?: string | null;
  updated?: object;
}) {
  const {
    category = { id: 'c1', user_id: 'u1' },
    householdId = 'h-1',
    updated = { id: 'c1', household_id: 'h-1' },
  } = opts;
  return createSupabaseMock({
    tables: {
      categories: [
        { data: category, error: null },
        { data: updated, error: null },
      ],
      household_members: {
        data: householdId ? { household_id: householdId } : null,
        error: null,
      },
    },
  });
}

/** The payload of the categories update - on whichever chain received it. */
const updatePayload = (db: ReturnType<typeof adminClient>) =>
  db.allCallsTo('categories', 'update')[0]![0];

beforeEach(() => jest.clearAllMocks());

it('shares a category by setting household_id (works for the caller’s own category)', async () => {
  const db = adminClient({});
  mockServiceClient.mockReturnValue(db.client as never);
  await setCategoryShared('u1', 'c1', true);
  expect(updatePayload(db)).toEqual({ household_id: 'h-1' });
});

it('un-shares a category by clearing household_id (no membership lookup needed)', async () => {
  const db = adminClient({ updated: { id: 'c1', household_id: null } });
  mockServiceClient.mockReturnValue(db.client as never);
  await setCategoryShared('u1', 'c1', false);
  expect(updatePayload(db)).toEqual({ household_id: null });
});

it('throws CategoryNotFoundError when the category is not the caller’s', async () => {
  mockServiceClient.mockReturnValue(
    adminClient({ category: { id: 'c1', user_id: 'someone-else' } }).client as never
  );
  await expect(setCategoryShared('u1', 'c1', true)).rejects.toBeInstanceOf(CategoryNotFoundError);
});

it('throws NotHouseholdMemberError when sharing without a household', async () => {
  mockServiceClient.mockReturnValue(adminClient({ householdId: null }).client as never);
  await expect(setCategoryShared('u1', 'c1', true)).rejects.toBeInstanceOf(NotHouseholdMemberError);
});
