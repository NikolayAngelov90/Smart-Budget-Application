/**
 * Category Share Service
 * Story 13.5 follow-up: share/unshare ANY of the caller's categories with their household —
 * including predefined/default ones.
 *
 * Sharing just toggles categories.household_id. Writes go through the service-role client so
 * it works for predefined categories too (the categories UPDATE RLS policy has an
 * is_predefined = false guard, and only allows the dual-path owner/member branches). The
 * explicit ownership + membership checks here are the authorization. Name/color/is_predefined
 * are never touched, so a default category stays a default category — just shared.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';
import type { Category } from '@/types/category.types';

/** The category doesn't exist or isn't owned by the caller. → 404 */
export class CategoryNotFoundError extends Error {
  constructor(message = 'Category not found') {
    super(message);
    this.name = 'CategoryNotFoundError';
  }
}

/**
 * Shares (or un-shares) one of the caller's own categories with their household.
 * @throws NotHouseholdMemberError if the caller has no household.
 * @throws CategoryNotFoundError if the category isn't theirs / doesn't exist.
 */
export async function setCategoryShared(
  userId: string,
  categoryId: string,
  shared: boolean
): Promise<Category> {
  const admin = createServiceRoleClient();

  // Must be the caller's own category (you can't share a co-member's).
  const { data: category, error: fetchError } = await admin
    .from('categories')
    .select('id, user_id')
    .eq('id', categoryId)
    .maybeSingle();
  if (fetchError) {
    logger.error('CategoryShareService', `lookup failed: ${fetchError.message}`);
    throw new Error('Failed to load category');
  }
  if (!category || category.user_id !== userId) throw new CategoryNotFoundError();

  let householdId: string | null = null;
  if (shared) {
    const { data: membership, error: memberError } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (memberError) {
      logger.error('CategoryShareService', `membership lookup failed: ${memberError.message}`);
      throw new Error('Failed to load household membership');
    }
    if (!membership?.household_id) throw new NotHouseholdMemberError();
    householdId = membership.household_id;
  }

  const { data: updated, error: updateError } = await admin
    .from('categories')
    .update({ household_id: householdId })
    .eq('id', categoryId)
    .select()
    .single();
  if (updateError || !updated) {
    logger.error('CategoryShareService', `update failed: ${updateError?.message}`);
    throw new Error('Failed to update category sharing');
  }
  return updated as Category;
}
