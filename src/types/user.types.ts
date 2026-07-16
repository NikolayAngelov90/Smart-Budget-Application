/**
 * User Types
 * Story 8.3: Settings Page and Account Management
 * Story 10-3: Multi-Currency User Settings & Configuration
 *
 * Type definitions for user profiles and preferences
 */

/**
 * User preferences stored as JSONB in user_profiles table
 * AC-8.3.5: Preferences include currency format, date format, and onboarding status
 * AC-10.3.1: Default currency is EUR
 */
export interface UserPreferences {
  /** Currency format for monetary displays (default: EUR) */
  currency_format: 'USD' | 'EUR' | 'GBP';

  /** Date format for date displays */
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

  /** Whether user has completed onboarding tutorial */
  onboarding_completed: boolean;

  /** UI language preference (Story 10-1) */
  language: 'en' | 'bg';

  /** Opt-in/out for weekly financial digest (Story 11.7, default: true) */
  weekly_digest_enabled?: boolean;

  /** Opt-in for spending nudge push notifications (Story 12.3, default: false — opt-in only) */
  push_nudges_enabled?: boolean;

  /** Achievement/milestone unlock pushes (Story 15.5, default: true for subscribed users) */
  push_milestones_enabled?: boolean;

  /** Household event pushes — invites, joins, shared-goal milestones (Story 15.5, default: true) */
  push_household_enabled?: boolean;

  /** Weekly digest ready pushes (Story 15.5, default: true for subscribed users) */
  push_digest_enabled?: boolean;

  /** Re-engagement pushes after 7 days of inactivity (Story 15.5, default: false — opt-in only) */
  push_reengagement_enabled?: boolean;

  /** Quiet hours start — hour in UTC 0-23 (default: 22). No push sent during quiet window. */
  quiet_hours_start?: number;

  /** Quiet hours end — hour in UTC 0-23 (default: 8). No push sent during quiet window. */
  quiet_hours_end?: number;

  /** ISO timestamp the user last dismissed the welcome-back summary (Story 12.6) */
  reengagement_dismissed_at?: string;
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
