'use client';

/**
 * useGamification — Story 15.6 (FR33)
 *
 * The single client-side gamification gate. Thin wrapper over
 * useUserPreferences (SWR on /api/user/profile — localStorage-cached, so warm
 * loads resolve instantly with no extra fetch path). Absent flag = enabled
 * (opt-OUT model: existing users keep their current experience); explicit
 * false hides all gamification UI while server-side accrual continues.
 */

import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

export interface UseGamificationResult {
  enabled: boolean;
  isLoading: boolean;
}

export function useGamification(): UseGamificationResult {
  const { preferences, isLoading } = useUserPreferences();

  return {
    // ?? (not ||): only an EXPLICIT false opts out; absent flag defaults on
    enabled: preferences?.gamification_enabled ?? true,
    isLoading,
  };
}
