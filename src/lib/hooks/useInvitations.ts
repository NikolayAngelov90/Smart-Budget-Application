/**
 * Story 13.2: Household Invitation Flow
 * Custom Hook: useInvitations — the caller's household invitations (admin-only API).
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { HouseholdInvitationWithState } from '@/types/database.types';

interface InvitationsResponse {
  data: HouseholdInvitationWithState[];
}

export interface UseInvitationsResult {
  invitations: HouseholdInvitationWithState[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<InvitationsResponse>;
}

export function useInvitations(enabled = true): UseInvitationsResult {
  const { data, error, isLoading, mutate } = useSWR<InvitationsResponse>(
    enabled ? '/api/invitations' : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch invitations');
      return response.json();
    }
  );

  return {
    invitations: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
