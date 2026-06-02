/**
 * Story 12.8: Engagement Analytics Dashboard
 * Custom Hook: useAnalyticsDashboard
 *
 * Fetches role-gated engagement aggregates. Distinguishes a 403 (not an
 * analytics_viewer) from other errors so the page can show an access-denied state.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { AnalyticsDashboardData, AnalyticsDashboardResponse, AnalyticsRange } from '@/types/database.types';

class ForbiddenError extends Error {}

export interface UseAnalyticsDashboardResult {
  data: AnalyticsDashboardData | null;
  isLoading: boolean;
  isForbidden: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<AnalyticsDashboardResponse>;
}

export function useAnalyticsDashboard(range: AnalyticsRange): UseAnalyticsDashboardResult {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsDashboardResponse>(
    `/api/analytics?range=${range}`,
    async (url: string) => {
      const response = await fetch(url);
      if (response.status === 403) {
        throw new ForbiddenError('Forbidden');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return response.json();
    }
  );

  return {
    data: data?.data ?? null,
    isLoading,
    isForbidden: error instanceof ForbiddenError,
    error,
    mutate,
  };
}
