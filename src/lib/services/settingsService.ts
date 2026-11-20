/**
 * Settings Service
 * Story 8.3: Settings Page and Account Management
 * Story 10-3: Multi-Currency User Settings & Configuration
 *
 * Handles user profile and preferences management with Supabase
 * RLS policies ensure users can only access their own data
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { UserProfile, UpdateUserProfilePayload, UserPreferences } from '@/types/user.types';
import { logger } from '@/lib/utils/logger';
import {
  AccountDeletionRefusedError,
  readPreparedChanges,
} from '@/lib/services/accountDeletionRefusal';

/**
 * Get user profile by ID
 * AC-8.3.2: Fetch user profile for display
 *
 * @param userId - User ID (UUID)
 * @returns UserProfile or null if not found
 * @throws Error if database query fails
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();

    // Fetch email from auth.users first
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      logger.error('SettingsService', 'Error fetching auth user:', authError);
      throw new Error('Failed to fetch user authentication data');
    }

    // Fetch user profile with RLS enforcement
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // If profile doesn't exist, create it (for existing users before migration)
    if (profileError && profileError.code === 'PGRST116') {
      logger.info(
        'SettingsService',
        `Profile not found, creating default profile for user: ${userId}`
      );

      const defaultPreferences = {
        // eslint-disable-next-line no-restricted-syntax
        currency_format: 'EUR',
        date_format: 'MM/DD/YYYY',
        onboarding_completed: false,
        language: 'en',
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          preferences: defaultPreferences,
        })
        .select()
        .single();

      if (insertError) {
        logger.error('SettingsService', 'Error creating user profile:', insertError);
        throw new Error(`Failed to create user profile: ${insertError.message}`);
      }

      // Return newly created profile
      const userProfile: UserProfile = {
        id: newProfile.id,
        display_name: newProfile.display_name,
        email: authData.user.email || '',
        profile_picture_url: newProfile.profile_picture_url,
        preferences: newProfile.preferences as unknown as UserPreferences,
        created_at: newProfile.created_at,
        updated_at: newProfile.updated_at,
      };

      return userProfile;
    }

    if (profileError) {
      logger.error('SettingsService', 'Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile) {
      return null;
    }

    // Combine profile data with email from auth
    const userProfile: UserProfile = {
      id: profile.id,
      display_name: profile.display_name,
      email: authData.user.email || '',
      profile_picture_url: profile.profile_picture_url,
      preferences: profile.preferences as unknown as UserPreferences,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    return userProfile;
  } catch (error) {
    logger.error('SettingsService', 'getUserProfile error:', error);
    throw error;
  }
}

/**
 * Every key `preferences` is allowed to hold. An unknown key would be merged
 * into the JSONB verbatim and then live there forever, invisible to the types.
 */
const KNOWN_PREFERENCE_KEYS = new Set<string>([
  'currency_format',
  'date_format',
  'onboarding_completed',
  'language',
  'weekly_digest_enabled',
  'push_nudges_enabled',
  'push_milestones_enabled',
  'push_household_enabled',
  'push_digest_enabled',
  'push_reengagement_enabled',
  'timezone',
  'quiet_hours_start',
  'quiet_hours_end',
  'reengagement_dismissed_at',
  'gamification_enabled',
  'disclosure_show_all',
]);

export class UnknownPreferenceKeyError extends Error {
  constructor(public readonly keys: string[]) {
    super(`Unknown preference key(s): ${keys.join(', ')}`);
    this.name = 'UnknownPreferenceKeyError';
  }
}

function assertKnownPreferenceKeys(patch: Partial<UserPreferences>): void {
  const unknown = Object.keys(patch).filter((k) => !KNOWN_PREFERENCE_KEYS.has(k));
  if (unknown.length > 0) throw new UnknownPreferenceKeyError(unknown);
}

/** Postgres 42883 = undefined_function; PostgREST also 404s an unknown RPC. */
function isMissingFunction(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return (
    e.code === '42883' ||
    e.code === 'PGRST202' ||
    /could not find the function|does not exist/i.test(e.message ?? '')
  );
}

/**
 * Update user profile
 * AC-8.3.6: Optimistic UI updates for profile changes
 * AC-8.3.7: Success feedback after update
 *
 * @param userId - User ID (UUID)
 * @param updates - Partial profile updates
 * @returns Updated UserProfile
 * @throws Error if update fails
 */
export async function updateUserProfile(
  userId: string,
  updates: UpdateUserProfilePayload
): Promise<UserProfile> {
  try {
    const supabase = await createClient();

    // Prepare update payload
    const updatePayload: Record<string, unknown> = {};

    if (updates.display_name !== undefined) {
      updatePayload.display_name = updates.display_name;
    }

    if (updates.profile_picture_url !== undefined) {
      updatePayload.profile_picture_url = updates.profile_picture_url;
    }

    // DW-2: preferences are merged by POSTGRES, not here.
    //
    // This used to SELECT the current object, spread the partial over it in JS,
    // and UPDATE the whole thing. Two overlapping writes both read the same
    // starting point, so the second one resurrected the first one's previous
    // value — a toggle flipping itself back on. Logged three times; Story 16-8
    // put the digest and all five push toggles in one section, which turned it
    // from an edge case into the normal interaction.
    //
    // `patch_user_preferences` (migration 041) does `preferences || p_patch`
    // inside the UPDATE. No SELECT means no window to interleave.
    let patchedProfile: UserProfile | null = null;
    if (updates.preferences !== undefined) {
      assertKnownPreferenceKeys(updates.preferences);

      // Not in the generated Database types (same as goals/gamification) —
      // generic client, per the project convention.
      const { data: patched, error: patchError } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>
          ) => Promise<{ data: unknown; error: unknown }>;
        }
      ).rpc('patch_user_preferences', { p_patch: updates.preferences });

      if (patchError) {
        if (isMissingFunction(patchError)) {
          // Migration 041 not applied yet. Fall back to the old merge rather
          // than failing every preference write — this restores the race, but
          // only until the migration lands, and a broken Settings page is
          // strictly worse. Loud on purpose.
          logger.warn(
            'SettingsService',
            'patch_user_preferences missing (migration 041 not applied) — ' +
              'falling back to read-modify-write; preference writes can race'
          );
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('preferences')
            .eq('id', userId)
            .single();

          const currentPreferences =
            (currentProfile?.preferences as unknown as UserPreferences) || {
              // eslint-disable-next-line no-restricted-syntax
              currency_format: 'EUR',
              date_format: 'MM/DD/YYYY',
              onboarding_completed: false,
            };

          updatePayload.preferences = {
            ...currentPreferences,
            ...updates.preferences,
          };
        } else {
          logger.error('SettingsService', 'Preference patch failed:', patchError);
          throw new Error('Failed to update preferences');
        }
      } else {
        patchedProfile = (patched as unknown as UserProfile) ?? null;
      }
    }

    // Nothing else to write — return the row the atomic patch already produced.
    if (patchedProfile && Object.keys(updatePayload).length === 0) {
      return patchedProfile;
    }

    // Update profile with RLS enforcement
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error('SettingsService', 'Error updating user profile:', updateError);
      throw new Error(`Failed to update user profile: ${updateError.message}`);
    }

    // Fetch email from auth
    const { data: authData } = await supabase.auth.getUser();

    const userProfile: UserProfile = {
      id: updatedProfile.id,
      display_name: updatedProfile.display_name,
      email: authData.user?.email || '',
      profile_picture_url: updatedProfile.profile_picture_url,
      preferences: updatedProfile.preferences as unknown as UserPreferences,
      created_at: updatedProfile.created_at,
      updated_at: updatedProfile.updated_at,
    };

    return userProfile;
  } catch (error) {
    logger.error('SettingsService', 'updateUserProfile error:', error);
    throw error;
  }
}

/**
 * Update user preferences only
 * Convenience function for preference updates
 * AC-8.3.5: Currency and date format preferences
 *
 * @param userId - User ID (UUID)
 * @param preferences - Partial preferences to update
 * @returns Updated UserProfile
 * @throws Error if update fails
 */
export async function updatePreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<UserProfile> {
  return updateUserProfile(userId, { preferences });
}

/**
 * Delete user account and all associated data
 * AC-8.3.8: Account deletion with cascading deletes
 *
 * ORDERED SO EVERY INTERMEDIATE STATE IS VALID (spec-household-creator-account-deletion):
 *  1. prepare_account_deletion - one transaction of PREPARATORY writes: household
 *     ownership transfer, the user's shared objects to the owner, and copies of
 *     any of the user's categories another member's rows reference. None of it is
 *     destructive, so it stands correctly whether or not step 2 succeeds.
 *  2. admin.deleteUser - the ONLY destructive step, last. The auth.users cascade
 *     removes every personal row, user_profiles included (user_profiles.id
 *     REFERENCES auth.users ON DELETE CASCADE).
 *
 * There is deliberately no explicit user_profiles delete. It used to run FIRST, so
 * a refused auth delete (transactions.category_id is ON DELETE RESTRICT) left the
 * profile gone and the account and all its data in place. The RLS suite proves the
 * cascade removes the profile: account-deletion.rls.test.ts asserts no FK column
 * referencing auth.users - user_profiles.id among them - still holds the id.
 *
 * Degradation: both steps are core inputs (docs/api-conventions.md#Error-Handling),
 * so either failing throws and the route answers 500.
 *
 * A REFUSED auth delete is checked by effect before anything is claimed
 * (spec-account-deletion-refused-message): getUserById decides what happened.
 *  - the user still exists -> AccountDeletionRefusedError, carrying what the
 *    preparation reported, so the dialog can say what changed;
 *  - the user is gone -> the deletion DID happen; success;
 *  - the lookup fails, or prepare's result was unrecognisable -> a generic Error.
 *
 * @param userId - User ID (UUID)
 * @returns Success boolean
 * @throws AccountDeletionRefusedError if the auth delete was refused and the user still exists
 * @throws Error if deletion fails in any other way
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  try {
    const adminClient = createServiceRoleClient();

    // 1. PREPARATORY (non-destructive, one transaction). The RPC is not in the
    // generated Database types, hence the generic client.
    const { data: prepared, error: prepareError } = await (
      adminClient as unknown as SupabaseClient
    ).rpc('prepare_account_deletion', { p_user: userId });

    if (prepareError) {
      logger.error('SettingsService', 'Error preparing account deletion:', prepareError);
      throw new Error(`Failed to prepare account deletion: ${prepareError.message}`);
    }

    // What the preparation did, from its own result. An unrecognised shape only
    // means a refusal cannot be described; it never blocks the deletion.
    const changes = readPreparedChanges(prepared);
    if (!changes) {
      logger.warn('SettingsService', 'prepare_account_deletion returned an unrecognised result');
    }

    // 2. DESTRUCTIVE, last.
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      logger.error('SettingsService', 'Error deleting auth user:', authError);

      // A transport-level failure (no response, or a gateway error) says nothing
      // about whether GoTrue went on to delete the user, possibly AFTER any check
      // made now. Its outcome is unknown: never "not deleted".
      if (isOutcomeUnknown(authError)) {
        throw new Error(`Failed to delete user account (outcome unknown): ${authError.message}`);
      }

      // Verify by effect before claiming "your account was not deleted".
      const { data: lookup, error: lookupError } = await adminClient.auth.admin.getUserById(userId);
      if (isUserNotFound(lookupError)) {
        logger.warn(
          'SettingsService',
          'auth delete reported an error, but the user is gone: the deletion happened'
        );
        return true;
      }
      if (lookupError || lookup?.user?.id !== userId) {
        logger.warn(
          'SettingsService',
          'refused deletion NOT described: the existence check was inconclusive',
          { lookupError, foundUser: lookup?.user?.id ?? null }
        );
      } else if (!changes) {
        logger.warn(
          'SettingsService',
          "refused deletion NOT described: prepare's result was unrecognisable"
        );
      } else {
        throw new AccountDeletionRefusedError(changes, authError.message);
      }
      throw new Error(`Failed to delete user account: ${authError.message}`);
    }

    return true;
  } catch (error) {
    logger.error('SettingsService', 'deleteUserAccount error:', error);
    throw error;
  }
}

/**
 * GoTrue answers getUserById for a missing user with 404 AND code
 * `user_not_found` (pinned against the real stack in account-deletion.rls.test.ts).
 * A bare 404 - a misrouted or proxied call - must never read as "deleted".
 */
function isUserNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'user_not_found';
}

/**
 * supabase-js reports a request that got no usable answer as
 * AuthRetryableFetchError: status 0 (no response) or a 502/503/504 gateway error.
 * A refusal GoTrue itself returns ("Database error deleting user") is a 500.
 */
function isOutcomeUnknown(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const { status, name } = error as { status?: unknown; name?: unknown };
  return (
    name === 'AuthRetryableFetchError' ||
    typeof status !== 'number' ||
    status === 0 ||
    status >= 502
  );
}
