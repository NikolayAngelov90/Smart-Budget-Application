/**
 * Story 12.6 / FR8: Lapsed User Re-engagement Analysis
 * Custom Hook: useReengagement
 *
 * Fetches the welcome-back summary and exposes a dismiss action that persists
 * to user preferences (via PUT /api/user/profile).
 */

import useSWR, { type KeyedMutator, mutate as globalMutate } from 'swr';
import type { ReengagementResponse, ReengagementSummary } from '@/types/database.types';

export interface UseReengagementResult {
  summary: ReengagementSummary | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ReengagementResponse>;
  dismiss: () => Promise<void>;
}

export function useReengagement(): UseReengagementResult {
  const { data, error, isLoading, mutate } = useSWR<ReengagementResponse>(
    '/api/reengagement',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch re-engagement summary');
      }
      return response.json();
    }
  );

  const dismiss = async () => {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: { reengagement_dismissed_at: new Date().toISOString() },
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to dismiss re-engagement summary');
    }
    // Refresh this summary (becomes null) and the profile preferences cache
    await mutate();
    await globalMutate('/api/user/profile');
  };

  return {
    summary: data?.summary ?? null,
    isLoading,
    error,
    mutate,
    dismiss,
  };
}
