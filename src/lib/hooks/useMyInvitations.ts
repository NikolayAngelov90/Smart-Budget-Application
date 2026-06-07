/**
 * Story 13.2 follow-up — in-app invite delivery.
 * Custom Hook: useMyInvitations
 *
 * Pending invitations addressed to the authenticated user (for the accept banner).
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { MyInvitation } from '@/types/database.types';

interface MyInvitationsResponse {
  data: MyInvitation[];
}

export interface UseMyInvitationsResult {
  invitations: MyInvitation[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<MyInvitationsResponse>;
}

export function useMyInvitations(): UseMyInvitationsResult {
  const { data, error, isLoading, mutate } = useSWR<MyInvitationsResponse>(
    '/api/invitations/mine',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
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
