'use client';

/**
 * useBudgets Hook — ADR-025
 *
 * SWR hook for the caller's category budgets with current-month usage.
 */

import useSWR from 'swr';
import type { BudgetsResponse } from '@/types/database.types';
import { clientTodayParam } from '@/lib/utils/date';

/**
 * The KEY constants are now PREFIXES, not whole keys: each request carries the
 * client's local `?today=`, because the server runs UTC and would otherwise put
 * the month boundary in the wrong place for hours of every day. The param also
 * rolls the cache over at local midnight, so an open tab picks up the new day.
 *
 * Anything revalidating these must match by PREFIX — an exact-key mutate stops
 * matching and goes silently stale.
 */
export const BUDGETS_KEY = '/api/budgets';

/** Full request URL for the client's current local day. */
function budgetsUrl(): string {
  return `${BUDGETS_KEY}?today=${clientTodayParam()}`;
}

async function fetcher(url: string): Promise<BudgetsResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch budgets');
  }
  return response.json();
}

export interface UseBudgetsResult {
  data: BudgetsResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => void;
}

export function useBudgets(): UseBudgetsResult {
  const { data, error, isLoading, mutate } = useSWR<BudgetsResponse>(budgetsUrl(), fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
