/**
 * Settings Service
 * Story 8.3: Settings Page and Account Management
 *
 * Handles user profile and preferences management with Supabase
 * RLS policies ensure users can only access their own data
 *
 * Note: Using @ts-ignore instead of @ts-expect-error because the user_profiles
 * table exists in the database but hasn't been added to generated types yet.
 * The table will be created by the migration at runtime.
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { createClient } from '@/lib/supabase/server';
import type { UserProfile, UpdateUserProfilePayload, UserPreferences } from '@/types/user.types';

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

    // Fetch user profile with RLS enforcement
    // @ts-ignore - user_profiles table exists but not in generated types yet
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile) {
      return null;
    }

    // Fetch email from auth.users
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      console.error('Error fetching auth user:', authError);
      throw new Error('Failed to fetch user authentication data');
    }

    // Combine profile data with email from auth
    // @ts-ignore - profile fields exist but types not generated yet
    const userProfile: UserProfile = {
      id: profile.id,
      display_name: profile.display_name,
      email: authData.user.email || '',
      profile_picture_url: profile.profile_picture_url,
      preferences: profile.preferences as UserPreferences,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    return userProfile;
  } catch (error) {
    console.error('getUserProfile error:', error);
    throw error;
  }
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

    if (updates.preferences !== undefined) {
      // Merge with existing preferences
      // @ts-ignore - user_profiles table exists but not in generated types yet
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      const currentPreferences = (currentProfile?.preferences as UserPreferences) || {
        currency_format: 'USD',
        date_format: 'MM/DD/YYYY',
        onboarding_completed: false,
      };

      updatePayload.preferences = {
        ...currentPreferences,
        ...updates.preferences,
      };
    }

    // Update profile with RLS enforcement
    // @ts-ignore - user_profiles table exists but not in generated types yet
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      throw new Error(`Failed to update user profile: ${updateError.message}`);
    }

    // Fetch email from auth
    const { data: authData } = await supabase.auth.getUser();

    // @ts-ignore - profile fields exist but types not generated yet
    const userProfile: UserProfile = {
      id: updatedProfile.id,
      display_name: updatedProfile.display_name,
      email: authData.user?.email || '',
      profile_picture_url: updatedProfile.profile_picture_url,
      preferences: updatedProfile.preferences as UserPreferences,
      created_at: updatedProfile.created_at,
      updated_at: updatedProfile.updated_at,
    };

    return userProfile;
  } catch (error) {
    console.error('updateUserProfile error:', error);
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
    // @ts-ignore - user_profiles table exists but not in generated types yet
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      throw new Error(`Failed to delete user profile: ${profileError.message}`);
    }

    // Delete auth user (cascades to transactions, categories, insights)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      throw new Error(`Failed to delete user account: ${authError.message}`);
    }

    return true;
  } catch (error) {
    console.error('deleteUserAccount error:', error);
    throw error;
  }
}
