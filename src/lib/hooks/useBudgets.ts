'use client';

/**
 * useBudgets Hook — ADR-025
 *
 * SWR hook for the caller's category budgets with current-month usage.
 */

import useSWR from 'swr';
import type { BudgetsResponse } from '@/types/database.types';
import { useDatedParams } from '@/lib/hooks/useClientToday';

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
function budgetsUrl(dated: string): string {
  return `${BUDGETS_KEY}?${dated}`;
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

/**
 * HP-7: the day comes from `useClientToday()`, which re-renders when the
 * local day changes. Calling `clientTodayParam()` inline looked equivalent
 * but only recomputed on a render that happened for some OTHER reason — an
 * idle tab kept yesterday's key and `revalidateOnFocus` refetched that same
 * stale key, so a dashboard left open overnight showed last month on the 1st.
 */
export function useBudgets(): UseBudgetsResult {
  const dated = useDatedParams();
  const { data, error, isLoading, mutate } = useSWR<BudgetsResponse>(budgetsUrl(dated), fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
