/**
 * Story 13.1: Household Creation & Database Foundation
 * Custom Hook: useHousehold
 *
 * Fetches the authenticated user's household (with their role), or null.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdWithRole } from '@/types/database.types';

interface HouseholdResponse {
  data: HouseholdWithRole | null;
}

export interface UseHouseholdResult {
  household: HouseholdWithRole | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<HouseholdResponse>;
}

export function useHousehold(): UseHouseholdResult {
  const { data, error, isLoading, mutate } = useSWR<HouseholdResponse>(
    '/api/households',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch household');
      }
      return response.json();
    }
  );

  return {
    household: data?.data ?? null,
    isLoading,
    error,
    mutate,
  };
}
