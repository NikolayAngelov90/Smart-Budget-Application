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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

interface ChainStub {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
}

/** Chainable query stub: every method returns `this`; terminals + await resolve to `result`. */
function chain(result: { data: unknown; error: unknown }): ChainStub {
  const q = {} as ChainStub;
  const bag = q as unknown as Record<string, jest.Mock>;
  for (const m of ['select', 'eq', 'order', 'insert', 'update']) {
    bag[m] = jest.fn(() => q);
  }
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.single = jest.fn().mockResolvedValue(result);
  (q as unknown as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}

type Plan = Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>;

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
      makeClient({ wishlist_items: { data: [ITEM_ROW], error: null } }) as never
    );
    await expect(listWishlist('u-1')).resolves.toEqual([ITEM_ROW]);
  });

  it('throws a friendly error on db failure', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: null, error: { message: 'boom' } } }) as never
    );
    await expect(listWishlist('u-1')).rejects.toThrow('Failed to load wishlist');
  });
});

describe('createItem', () => {
  it('creates an item without a category (no category lookup)', async () => {
    const client = makeClient({ wishlist_items: { data: ITEM_ROW, error: null } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await createItem('u-1', '  Headphones  ', 199.99, null);
    expect(result).toEqual(ITEM_ROW);
    expect(client.from).not.toHaveBeenCalledWith('categories');
    const insertChain = client.from.mock.results[0]!.value as ChainStub;
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
      }) as never
    );
    const result = await createItem('u-1', 'Headphones', 199.99, 'cat-1');
    expect(result.category_id).toBe('cat-1');
  });

  it('rejects a category the user does not own', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ categories: { data: null, error: null } }) as never
    );
    await expect(createItem('u-1', 'X', 10, 'cat-x')).rejects.toBeInstanceOf(WishlistCategoryError);
  });

  it('rejects income categories', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({
        categories: { data: { id: 'cat-1', user_id: 'u-1', type: 'income' }, error: null },
      }) as never
    );
    await expect(createItem('u-1', 'X', 10, 'cat-1')).rejects.toBeInstanceOf(WishlistCategoryError);
  });
});

describe('updateStatus', () => {
  it('updates the caller own row', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: [{ ...ITEM_ROW, status: 'purchased' }], error: null } }) as never
    );
    const result = await updateStatus('u-1', 'w-1', 'purchased');
    expect(result.status).toBe('purchased');
  });

  it('throws WishlistItemNotFoundError when no row matched (foreign/unknown id)', async () => {
    mockCreateClient.mockResolvedValue(
      makeClient({ wishlist_items: { data: [], error: null } }) as never
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
