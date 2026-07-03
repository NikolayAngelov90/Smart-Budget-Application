'use client';

/**
 * useWhatIf Hook — Story 14.4
 *
 * SWR hook for the What-If simulator's static context (category averages,
 * subscriptions, nearest goal). Projection math runs client-side.
 */

import useSWR from 'swr';
import type { WhatIfContextResponse } from '@/types/database.types';

export const WHAT_IF_KEY = '/api/what-if';

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

export function useWhatIf(): UseWhatIfResult {
  const { data, error, isLoading, mutate } = useSWR<WhatIfContextResponse>(WHAT_IF_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
