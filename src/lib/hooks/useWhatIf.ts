'use client';

/**
 * useWhatIf Hook — Story 14.4
 *
 * SWR hook for the What-If simulator's static context (category averages,
 * subscriptions, nearest goal). Projection math runs client-side.
 */

import useSWR from 'swr';
import type { WhatIfContextResponse } from '@/types/database.types';
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
export const WHAT_IF_KEY = '/api/what-if';

/** Full request URL for the client's current local day. */
function what_ifUrl(dated: string): string {
  return `${WHAT_IF_KEY}?${dated}`;
}

async function fetcher(url: string): Promise<WhatIfContextResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch what-if context');
  }
  return response.json();
}

export interface UseWhatIfResult {
  data: WhatIfContextResponse | undefined;
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
export function useWhatIf(): UseWhatIfResult {
  const dated = useDatedParams();
  const { data, error, isLoading, mutate } = useSWR<WhatIfContextResponse>(what_ifUrl(dated), fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
