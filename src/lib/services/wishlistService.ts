/**
 * Wishlist Service — Story 14.3 (FR15)
 *
 * CRUD for personal wishlist items. Purely personal — every call uses the
 * AUTH-SCOPED client so the owner-only RLS (migration 033) is the security
 * boundary and is exercised in production (no service-role), like budgetService.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { WishlistItem, WishlistStatus } from '@/types/database.types';

export class WishlistCategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WishlistCategoryError';
  }
}

export class WishlistItemNotFoundError extends Error {
  constructor() {
    super('Wishlist item not found');
    this.name = 'WishlistItemNotFoundError';
  }
}

const VALID_STATUSES: WishlistStatus[] = ['active', 'purchased', 'removed'];

/** Returns all of the caller's wishlist items, newest first. */
export async function listWishlist(userId: string): Promise<WishlistItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('WishlistService', `list failed: ${error.message}`);
    throw new Error('Failed to load wishlist');
  }
  return (data ?? []) as WishlistItem[];
}

/**
 * Creates a wishlist item. A linked category (optional) must be RLS-visible,
 * owned by the user, and an expense category.
 */
export async function createItem(
  userId: string,
  name: string,
  price: number,
  categoryId: string | null
): Promise<WishlistItem> {
  const supabase = await createClient();

  if (categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, user_id, type')
      .eq('id', categoryId)
      .eq('user_id', userId)
      .maybeSingle();

    if (categoryError) {
      logger.error('WishlistService', `category lookup failed: ${categoryError.message}`);
      throw new Error('Failed to validate category');
    }
    if (!category) {
      throw new WishlistCategoryError('Category not found');
    }
    if (category.type !== 'expense') {
      throw new WishlistCategoryError('Wishlist items can only link expense categories');
    }
  }

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: userId,
      name: name.trim(),
      price,
      category_id: categoryId,
    })
    .select('*')
    .single();

  if (error || !data) {
    logger.error('WishlistService', `insert failed: ${error?.message}`);
    throw new Error('Failed to save wishlist item');
  }
  return data as WishlistItem;
}

/** Updates an item's status (active | purchased | removed) on the caller's own row. */
export async function updateStatus(
  userId: string,
  itemId: string,
  status: WishlistStatus
): Promise<WishlistItem> {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid wishlist status');
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('wishlist_items')
    .update({ status })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('*');

  if (error) {
    logger.error('WishlistService', `status update failed: ${error.message}`);
    throw new Error('Failed to update wishlist item');
  }
  if (!data || data.length === 0) {
    throw new WishlistItemNotFoundError();
  }
  return data[0] as WishlistItem;
}
