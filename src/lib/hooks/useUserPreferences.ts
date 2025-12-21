/**
 * Story 8.3: Settings Page and Account Management
 * Custom Hook: useUserPreferences
 *
 * Fetches and provides user preferences (date format, currency format, etc.)
 */

import useSWR from 'swr';
import type { UserProfile, UserPreferences } from '@/types/user.types';

interface UseUserPreferencesResult {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: any;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  currency_format: 'USD',
  date_format: 'MM/DD/YYYY',
  onboarding_completed: false,
};

/**
 * Hook to fetch and access user preferences
 * Uses SWR for caching and automatic updates
 */
export function useUserPreferences(): UseUserPreferencesResult {
  const { data, error, isLoading } = useSWR<{ data: UserProfile }>(
    '/api/user/profile',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    }
  );

  return {
    preferences: data?.data?.preferences || DEFAULT_PREFERENCES,
    isLoading,
    error,
  };
}
