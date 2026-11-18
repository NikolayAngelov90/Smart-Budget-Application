/**
 * wishlistService tests — Story 14.3
 * Mocked Supabase (service boundary). Owner-only RLS (migration 033) is the
 * production gate; service behavior is what's covered here.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  listWishlist,
  createItem,
  updateStatus,
  WishlistCategoryError,
  WishlistItemNotFoundError,
} from '@/lib/services/wishlistService';
import type { WishlistStatus } from '@/types/database.types';
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
 * CONTROL-ARM FILE: wishlistService has no catch at all, so a mock gap here fails
 * visibly. It was missed by the original census, which matched only
 * `from: jest.fn(` and not `const from = jest.fn(`.
 */
type Result = { data: unknown; error: unknown };
type Plan = Record<string, Result | Result[]>;

function makeClient(plan: Plan) {
  return createSupabaseMock({ tables: plan as never });
}

const ITEM_ROW = {
  id: 'w-1',
  user_id: 'u-1',
  category_id: null,
  name: 'Headphones',
  price: 199.99,
  status: 'active',
  created_at: '2026-07-02T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('listWishlist', () => {
  it('returns the user items', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: [ITEM_ROW], error: null } }).client as never
    );
    await expect(listWishlist('u-1')).resolves.toEqual([ITEM_ROW]);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: null, error: { message: 'boom' } } }).client as never
    );
    await expect(listWishlist('u-1')).rejects.toThrow('Failed to load wishlist');
  });
});

describe('createItem', () => {
  it('creates an item without a category (no category lookup)', async () => {
    const db = makeClient({ wishlist_items: { data: ITEM_ROW, error: null } });
    mockCreateClient.mockResolvedValue(db.client as never);

    const result = await createItem('u-1', '  Headphones  ', 199.99, null);
    expect(result).toEqual(ITEM_ROW);
    expect(db.from).not.toHaveBeenCalledWith('categories');
    const insertChain = db.chainFor('wishlist_items');
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'u-1',
      name: 'Headphones', // trimmed
      price: 199.99,
      category_id: null,
    });
  });

  it('creates an item with an owned expense category', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'expense' }, error: null },
        wishlist_items: { data: { ...ITEM_ROW, category_id: 'cat-1' }, error: null },
      }).client as never
    );
    const result = await createItem('u-1', 'Headphones', 199.99, 'cat-1');
    expect(result.category_id).toBe('cat-1');
  });

  it('rejects a category the user does not own', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ categories: { data: null, error: null } }).client as never
    );
    await expect(createItem('u-1', 'X', 10, 'cat-x')).rejects.toBeInstanceOf(WishlistCategoryError);
  });

  it('rejects income categories', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'income' }, error: null },
      }).client as never
    );
    await expect(createItem('u-1', 'X', 10, 'cat-1')).rejects.toBeInstanceOf(WishlistCategoryError);
  });
});

describe('updateStatus', () => {
  it('updates the caller own row', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        wishlist_items: { data: [{ ...ITEM_ROW, status: 'purchased' }], error: null },
      }).client as never
    );
    const result = await updateStatus('u-1', 'w-1', 'purchased');
    expect(result.status).toBe('purchased');
  });

  it('throws WishlistItemNotFoundError when no row matched (foreign/unknown id)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: [], error: null } }).client as never
    );
    await expect(updateStatus('u-1', 'w-x', 'removed')).rejects.toBeInstanceOf(
      WishlistItemNotFoundError
    );
  });

  it('rejects an invalid status before touching the db', async () => {
    await expect(updateStatus('u-1', 'w-1', 'bought' as WishlistStatus)).rejects.toThrow(
      'Invalid wishlist status'
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
