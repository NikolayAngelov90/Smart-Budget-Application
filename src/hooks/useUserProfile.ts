'use client';

/**
 * Shared hook for user profile data.
 * Uses direct fetch (bypassing SWR) to avoid localStorage cache issues.
 * After fetching, updates the SWR provider cache so other consumers
 * (e.g. ProfilePictureUpload) can trigger a refresh via mutate(PROFILE_KEY).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSWRConfig } from 'swr';
import type { UserProfile } from '@/types/user.types';

const PROFILE_KEY = '/api/user/profile';

/** Global listeners that get called when any component calls refreshProfile() */
const profileListeners = new Set<() => void>();

/** Notify all useUserProfile instances to re-fetch */
export function refreshProfile() {
  profileListeners.forEach((listener) => listener());
}

export function useUserProfile(enabled = true) {
  const [data, setData] = useState<UserProfile | null>(null);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { mutate } = useSWRConfig();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const fetchProfile = useCallback(async () => {
    if (!enabledRef.current) return;
    setIsLoading(true);
    setError(undefined);
    try {
      const res = await fetch(PROFILE_KEY);
      if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setData(null);
        return;
      }
      const json = await res.json();
      const profile: UserProfile | null = json.data ?? null;
      setData(profile);
      // Update SWR provider cache so mutate(PROFILE_KEY) from other
      // components (e.g. ProfilePictureUpload) triggers a refresh.
      mutate(PROFILE_KEY, profile, false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [mutate]);

  // Fetch on mount when enabled
  useEffect(() => {
    if (!enabled) return;
    fetchProfile();
  }, [enabled, fetchProfile]);

  // Listen for refresh signals from other components
  useEffect(() => {
    profileListeners.add(fetchProfile);
    return () => {
      profileListeners.delete(fetchProfile);
    };
  }, [fetchProfile]);

  return {
    data,
    error,
    isLoading,
    mutate: fetchProfile,
  };
}

export { PROFILE_KEY };
