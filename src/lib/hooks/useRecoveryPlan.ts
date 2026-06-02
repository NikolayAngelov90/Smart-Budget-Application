/**
 * Story 12.4 / FR4: 30-Day Budget Recovery Plans
 * Custom Hook: useRecoveryPlan
 *
 * Fetches the active recovery plan + progress via SWR and exposes actions
 * to generate a new plan or dismiss (abandon) the current one.
 */

import useSWR, { type KeyedMutator } from 'swr';
import type { RecoveryPlanProgress, RecoveryPlanResponse } from '@/types/database.types';

export interface UseRecoveryPlanResult {
  plan: RecoveryPlanProgress | null;
  canGenerate: boolean;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<RecoveryPlanResponse>;
  generate: () => Promise<void>;
  dismiss: (planId: string) => Promise<void>;
}

export function useRecoveryPlan(): UseRecoveryPlanResult {
  const { data, error, isLoading, mutate } = useSWR<RecoveryPlanResponse>(
    '/api/recovery-plan',
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch recovery plan');
      }
      return response.json();
    }
  );

  const generate = async () => {
    const res = await fetch('/api/recovery-plan', { method: 'POST' });
    if (!res.ok) {
      throw new Error('Failed to generate recovery plan');
    }
    await mutate();
  };

  const dismiss = async (planId: string) => {
    const res = await fetch(`/api/recovery-plan/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'abandoned' }),
    });
    if (!res.ok) {
      throw new Error('Failed to dismiss recovery plan');
    }
    await mutate();
  };

  return {
    plan: data?.plan ?? null,
    canGenerate: data?.canGenerate ?? false,
    isLoading,
    error,
    mutate,
    generate,
    dismiss,
  };
}
