'use client';

/**
 * useDashboardStats Hook
 * Story 5.2: Financial Summary Cards
 *
 * SWR hook for fetching dashboard financial statistics
 */

import useSWR from 'swr';
import type { DashboardStatsResponse } from '@/app/api/dashboard/stats/route';

/**
 * Fetcher function for SWR
 * @param url - API endpoint URL
 * @returns Dashboard stats response
 */
async function fetcher(url: string): Promise<DashboardStatsResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return response.json();
}

/**
 * Hook return type
 */
export interface UseDashboardStatsResult {
  data: DashboardStatsResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

/**
 * Custom hook for fetching dashboard stats with SWR
 * @param month - Optional month in YYYY-MM format (defaults to current month)
 * @returns Dashboard stats data, error, loading state, and mutate function
 */
export function useDashboardStats(month?: string): UseDashboardStatsResult {
  const url = month ? `/api/dashboard/stats?month=${month}` : '/api/dashboard/stats';

  const { data, error, isLoading, mutate } = useSWR<DashboardStatsResponse>(
    url,
    fetcher,
    {
      // Deduplicate requests within 1 second for faster updates
      dedupingInterval: 1000,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
      // Revalidate on mount
      revalidateOnMount: true,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Disable automatic revalidation interval (we'll use Realtime instead)
      refreshInterval: 0,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}
