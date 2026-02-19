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
 * @param currency - Optional preferred currency code for cross-currency conversion (e.g. 'EUR')
 * @returns Dashboard stats data, error, loading state, and mutate function
 */
export function useDashboardStats(month?: string, currency?: string): UseDashboardStatsResult {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (currency) params.set('currency', currency);
  const query = params.toString();
  const url = query ? `/api/dashboard/stats?${query}` : '/api/dashboard/stats';

  const { data, error, isLoading, mutate } = useSWR<DashboardStatsResponse>(
    url,
    fetcher,
    {
      // Deduplicate requests within 5 seconds for reasonable caching
      dedupingInterval: 5000,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
      // Revalidate on network reconnect
      revalidateOnReconnect: true,
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
