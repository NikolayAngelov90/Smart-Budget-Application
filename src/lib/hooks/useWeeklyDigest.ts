/**
 * useWeeklyDigest Hook
 * Story 11.7: Weekly Financial Digest
 *
 * Fetches the latest weekly digest for the current user via SWR.
 * Returns null when no digest has been generated yet (progressive disclosure).
 */

import useSWR from 'swr';
import type { WeeklyDigest } from '@/types/database.types';

interface UseWeeklyDigestResult {
  digest: WeeklyDigest | null;
  isLoading: boolean;
  error: Error | undefined;
}

export function useWeeklyDigest(): UseWeeklyDigestResult {
  const { data, error, isLoading } = useSWR<{ data: WeeklyDigest | null }>(
    '/api/user/digest',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch digest');
      return res.json();
    }
  );

  return {
    digest: data?.data ?? null,
    isLoading,
    error,
  };
}
