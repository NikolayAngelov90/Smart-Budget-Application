/**
 * User Types
 * Story 8.3: Settings Page and Account Management
 *
 * Type definitions for user profiles and preferences
 */

/**
 * User preferences stored as JSONB in user_profiles table
 * AC-8.3.5: Preferences include currency format, date format, and onboarding status
 */
export interface UserPreferences {
  /** Currency format for monetary displays (MVP: USD only enabled) */
  currency_format: 'USD' | 'EUR' | 'GBP';

  /** Date format for date displays */
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

  /** Whether user has completed onboarding tutorial */
  onboarding_completed: boolean;

  /** UI language preference (Story 10-1) */
  language: 'en' | 'bg';
}

/**
 * User profile data model
 * AC-8.3.2: Profile includes display name, email, profile picture, and created date
 *
 * Matches user_profiles table schema with RLS policies
 */
export interface UserProfile {
  /** User ID (UUID) - Foreign key to auth.users(id) */
  id: string;

  /** Display name (editable by user) */
  display_name: string | null;

  /** Email address (read-only, from auth provider) */
  email: string;

  /** Profile picture URL (from social login or Supabase Storage) */
  profile_picture_url: string | null;

  /** User preferences (currency, date format, onboarding) */
  preferences: UserPreferences;

  /** Account creation timestamp */
  created_at: string;

  /** Last update timestamp (auto-updated by trigger) */
  updated_at: string;
}

/**
 * Partial update payload for profile modifications
 * Used by PUT /api/user/profile endpoint
 */
export interface UpdateUserProfilePayload {
  display_name?: string;
  profile_picture_url?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * Account deletion request payload
 * AC-8.3.8: Requires password confirmation
 */
export interface DeleteAccountPayload {
  /** User's password for verification */
  confirmation_password: string;
}

/**
 * Account deletion response
 * Includes success status and optional export data URL
 */
export interface DeleteAccountResponse {
  /** Whether deletion was successful */
  success: boolean;

  /** Optional URL to download exported user data */
  export_data_url?: string;
}
