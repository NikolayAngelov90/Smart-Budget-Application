/**
 * Settings Service
 * Story 8.3: Settings Page and Account Management
 * Story 10-3: Multi-Currency User Settings & Configuration
 *
 * Handles user profile and preferences management with Supabase
 * RLS policies ensure users can only access their own data
 */

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { UserProfile, UpdateUserProfilePayload, UserPreferences } from '@/types/user.types';
import { logger } from '@/lib/utils/logger';

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
      logger.info('SettingsService', `Profile not found, creating default profile for user: ${userId}`);

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
 * @param userId - User ID (UUID)
 * @returns Success boolean
 * @throws Error if deletion fails
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Delete user profile (cascades to auth.users via ON DELETE CASCADE)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      logger.error('SettingsService', 'Error deleting user profile:', profileError);
      throw new Error(`Failed to delete user profile: ${profileError.message}`);
    }

    // Delete auth user using service role client (admin operations require elevated privileges)
    const adminClient = createServiceRoleClient();
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      logger.error('SettingsService', 'Error deleting auth user:', authError);
      throw new Error(`Failed to delete user account: ${authError.message}`);
    }

    return true;
  } catch (error) {
    logger.error('SettingsService', 'deleteUserAccount error:', error);
    throw error;
  }
}
