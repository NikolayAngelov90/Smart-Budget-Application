/**
 * Story 13.6: Personal Allowance System
 * Custom Hook: useAllowance
 *
 * Fetches the authenticated user's allowance status (allowance + spent + remaining).
 * Owner-only on the server — no other member can ever receive this data.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { AllowanceStatus } from '@/types/database.types';

interface AllowanceResponse {
  data: AllowanceStatus;
}

export interface UseAllowanceResult {
  status: AllowanceStatus | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<AllowanceResponse>;
}

export function useAllowance(): UseAllowanceResult {
  const { data, error, isLoading, mutate } = useSWR<AllowanceResponse>(
    '/api/allowance',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch allowance');
      }
      return response.json();
    }
  );

  return {
    status: data?.data ?? null,
    isLoading,
    error,
    mutate,
  };
}
