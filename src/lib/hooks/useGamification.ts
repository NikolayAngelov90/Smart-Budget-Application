'use client';

/**
 * useGamification — Story 15.6 (FR33)
 *
 * The single client-side gamification gate. Thin wrapper over
 * useUserPreferences (SWR on /api/user/profile — localStorage-cached, so warm
 * loads resolve instantly with no extra fetch path). Absent flag = enabled
 * (opt-OUT model: existing users keep their current experience); explicit
 * false hides all gamification UI while server-side accrual continues.
 *
 * HOLD WHILE LOADING (15-6 review): `enabled` is false until preferences are
 * known, NOT defaulted-true. Failing open during the cold-cache window (new
 * device / cleared storage) would flash gamification UI to an opted-out user
 * and fire the score/comeback GETs from their browser before prefs resolve.
 * Warm loads (localStorage-cached prefs) report isLoading=false on the first
 * render, so the default-ON experience is instant for existing users.
 */

import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

export interface UseGamificationResult {
  enabled: boolean;
  isLoading: boolean;
}

export function useGamification(): UseGamificationResult {
  const { preferences, isLoading } = useUserPreferences();

  return {
    // Hold (disabled) until prefs are known; then ?? (not ||): only an
    // EXPLICIT false opts out — absent flag defaults on. An errored profile
    // fetch resolves isLoading=false + preferences=null -> default ON (safe
    // for the majority; a transient error must not hide gamification).
    enabled: isLoading ? false : (preferences?.gamification_enabled ?? true),
    isLoading,
  };
}
