'use client';

/**
 * useComeback Hook — Story 15.4
 *
 * SWR hook for the active comeback challenge (+ derived progress). The GET
 * returns STATE only (never one-shot events — 15-3 HIGH lesson), so caching
 * is safe. Revalidated after every transaction save (both lists) so the
 * progress bar advances immediately.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { ComebackResponse } from '@/types/database.types';

export const COMEBACK_KEY = '/api/comeback';

async function fetcher(url: string): Promise<ComebackResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch comeback challenge');
  }
  return response.json();
}

export interface UseComebackResult {
  data: ComebackResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<ComebackResponse>;
}

export function useComeback(): UseComebackResult {
  const { data, error, isLoading, mutate } = useSWR<ComebackResponse>(COMEBACK_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
