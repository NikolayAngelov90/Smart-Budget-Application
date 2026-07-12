'use client';

/**
 * useBudgetScore Hook — Story 15.2
 *
 * SWR hook for the caller's Budget Score. The localStorage SWR provider
 * persists this cache across page loads (instant repaint); tx-save onSuccess
 * revalidates SCORE_KEY so the score updates after each transaction (AC #4).
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { BudgetScoreResponse } from '@/types/database.types';

export const SCORE_KEY = '/api/gamification/score';

async function fetcher(url: string): Promise<BudgetScoreResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch budget score');
  }
  return response.json();
}

export interface UseBudgetScoreResult {
  data: BudgetScoreResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<BudgetScoreResponse>;
}

export function useBudgetScore(): UseBudgetScoreResult {
  const { data, error, isLoading, mutate } = useSWR<BudgetScoreResponse>(SCORE_KEY, fetcher, {
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  return { data, error, isLoading, mutate };
}
