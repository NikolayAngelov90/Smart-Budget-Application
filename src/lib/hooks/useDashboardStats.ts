'use client';

/**
 * useDashboardStats Hook
 * Story 5.2: Financial Summary Cards
 *
 * SWR hook for fetching dashboard financial statistics
 */

import useSWR from 'swr';
import { format } from 'date-fns';
import type { DashboardStatsResponse } from '@/app/api/dashboard/stats/route';
import type { DashboardPeriod } from '@/lib/utils/dashboardPeriod';

/** Prefix every dashboard-stats SWR key shares, whatever its params. */
export const DASHBOARD_STATS_KEY = '/api/dashboard/stats';

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
 * @param period - Story 16.6: week | month | quarter | year (defaults to month).
 *   Omitting it keeps the pre-16.6 key and behaviour exactly.
 * @returns Dashboard stats data, error, loading state, and mutate function
 */
export function useDashboardStats(
  month?: string,
  currency?: string,
  period?: DashboardPeriod
): UseDashboardStatsResult {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (currency) params.set('currency', currency);
  if (period) params.set('period', period);
  // The server runs UTC; the user's day is what defines "this week". Sending
  // the client's local date keeps the window aligned with the dates the client
  // writes onto transactions. It also rolls the SWR key over at local midnight,
  // so an open tab picks up the new day. Only on the period path, to leave the
  // pre-16.6 keys byte-identical.
  if (period) params.set('today', format(new Date(), 'yyyy-MM-dd'));
  const query = params.toString();
  const url = query ? `${DASHBOARD_STATS_KEY}?${query}` : DASHBOARD_STATS_KEY;

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
