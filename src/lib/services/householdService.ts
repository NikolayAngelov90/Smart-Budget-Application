/**
 * Household Service
 * Story 13.1: Household Creation & Database Foundation
 *
 * Server-side service for creating and reading households.
 * - Writes use the service-role client (bypasses RLS so the create can insert the
 *   household + the creator's admin membership and read the row back; the SELECT
 *   RLS policy requires membership which doesn't exist mid-insert).
 * - Reads use the caller's auth-scoped client so RLS is genuinely enforced.
 *
 * MVP rule (per AC#3): one household per user — enforced here, not just in the UI.
 */

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type {
  Household,
  HouseholdWithRole,
  HouseholdRole,
  HouseholdPreset,
  VisibilityLevel,
} from '@/types/database.types';

/** Thrown when a user who already belongs to a household tries to create another. */
export class HouseholdExistsError extends Error {
  constructor(message = 'User already belongs to a household') {
    super(message);
    this.name = 'HouseholdExistsError';
  }
}

/** Thrown when a transparency action requires household membership the caller lacks. → 403 */
export class NotHouseholdMemberError extends Error {
  constructor(message = 'You must belong to a household') {
    super(message);
    this.name = 'NotHouseholdMemberError';
  }
}

/**
 * Story 13.4: name keywords that mark a category as a "bill" (rent/utilities) for the
 * Roommates preset (shared by default; everything else private). Substring, case-insensitive.
 */
export const BILL_KEYWORDS = [
  'rent', 'mortgage', 'utilities', 'electric', 'power', 'water', 'gas',
  'internet', 'wifi', 'broadband', 'council tax', 'trash', 'garbage', 'sewage', 'heating',
];

function isBillCategory(name: string): boolean {
  const n = name.toLowerCase();
  return BILL_KEYWORDS.some((k) => n.includes(k));
}

function presetVisibility(preset: HouseholdPreset, categoryName: string): VisibilityLevel {
  if (preset === 'newlyweds') return 'shared';
  if (preset === 'partners') return 'category_only';
  // roommates: bills shared, everything else private
  return isBillCategory(categoryName) ? 'shared' : 'private';
}

const MAX_NAME_LENGTH = 100;

/**
 * Creates a household with the given user as its admin member.
 * @throws HouseholdExistsError if the user is already a member of a household.
 * @throws Error on validation failure or a database error.
 */
export async function createHousehold(userId: string, name: string): Promise<HouseholdWithRole> {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new Error('Household name must be 1–100 characters');
  }

  const admin = createServiceRoleClient();

  // Enforce one-household-per-user (MVP).
  const { data: existing, error: existingError } = await admin
    .from('household_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    logger.error('HouseholdService', `Membership lookup failed for ${userId}: ${existingError.message}`);
    throw new Error('Failed to check existing household membership');
  }
  if (existing) {
    throw new HouseholdExistsError();
  }

  // Insert the household.
  const { data: household, error: householdError } = await admin
    .from('households')
    .insert({ name: trimmed, created_by: userId })
    .select()
    .single();

  if (householdError || !household) {
    logger.error('HouseholdService', `Household insert failed for ${userId}: ${householdError?.message}`);
    throw new Error('Failed to create household');
  }

  // Insert the creator's admin membership; roll back the household on failure.
  const adminRole: HouseholdRole = 'admin';
  const { error: memberError } = await admin
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: adminRole });

  if (memberError) {
    logger.error('HouseholdService', `Membership insert failed for ${userId}, rolling back: ${memberError.message}`);
    await admin.from('households').delete().eq('id', household.id);
    throw new Error('Failed to create household membership');
  }

  return { ...(household as Household), role: adminRole };
}

/**
 * Returns the caller's household (with their role), or null if they have none.
 * Uses the auth-scoped client so RLS applies.
 */
export async function getCurrentHousehold(userId: string): Promise<HouseholdWithRole | null> {
  const supabase = await createClient();

  const { data: membership, error } = await supabase
    .from('household_members')
    .select('role, preset, households(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('HouseholdService', `getCurrentHousehold failed for ${userId}: ${error.message}`);
    throw new Error('Failed to fetch household');
  }
  if (!membership || !membership.households) {
    return null;
  }

  // `households(*)` returns the joined row (object for a to-one relationship).
  const household = membership.households as unknown as Household;
  return {
    ...household,
    role: membership.role as HouseholdRole,
    preset: (membership.preset ?? null) as HouseholdPreset | null,
  };
}

/**
 * Story 13.4: saves the caller's transparency preset and applies its default
 * visibility_level to the caller's OWN shared categories. Per-category overrides
 * are only changed by re-applying a preset. Never touches other members' categories.
 * @throws NotHouseholdMemberError if the caller has no household.
 */
export async function applyPreset(userId: string, preset: HouseholdPreset): Promise<HouseholdPreset> {
  const admin = createServiceRoleClient();

  const { data: membership, error: memberError } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) {
    logger.error('HouseholdService', `applyPreset membership lookup failed: ${memberError.message}`);
    throw new Error('Failed to load household membership');
  }
  if (!membership?.household_id) {
    throw new NotHouseholdMemberError();
  }
  const householdId = membership.household_id;

  // Save the chosen preset on the caller's membership row.
  const { error: presetError } = await admin
    .from('household_members')
    .update({ preset })
    .eq('user_id', userId);
  if (presetError) {
    logger.error('HouseholdService', `applyPreset save failed: ${presetError.message}`);
    throw new Error('Failed to save preset');
  }

  // Apply default visibility to the caller's own shared categories ('custom' = no change).
  if (preset !== 'custom') {
    const { data: cats, error: catError } = await admin
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('household_id', householdId);
    if (catError) {
      logger.error('HouseholdService', `applyPreset category fetch failed: ${catError.message}`);
      throw new Error('Failed to apply preset to categories');
    }
    for (const cat of cats ?? []) {
      const level = presetVisibility(preset, cat.name);
      const { error: updateError } = await admin
        .from('categories')
        .update({ visibility_level: level })
        .eq('id', cat.id);
      if (updateError) {
        // Don't leave the preset applied to only some categories silently.
        logger.error('HouseholdService', `applyPreset update failed for ${cat.id}: ${updateError.message}`);
        throw new Error('Failed to apply preset to categories');
      }
    }
  }

  return preset;
}
