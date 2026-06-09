/**
 * Story 13.11: Member Removal & Access Revocation
 * Custom Hook: useHouseholdMembers
 *
 * The caller's household roster (membership-gated) for the management UI.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdMemberListEntry } from '@/types/database.types';

interface HouseholdMembersResponse {
  data: HouseholdMemberListEntry[];
}

export interface UseHouseholdMembersResult {
  members: HouseholdMemberListEntry[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<HouseholdMembersResponse>;
}

export function useHouseholdMembers(): UseHouseholdMembersResult {
  const { data, error, isLoading, mutate } = useSWR<HouseholdMembersResponse>(
    '/api/households/members',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch household members');
      }
      return response.json();
    }
  );

  return {
    members: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
