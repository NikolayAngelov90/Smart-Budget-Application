'use client';

/**
 * Shared settings state — Story 16.8
 *
 * Settings moved from one 1200-line page to an index with sub-pages. Profile
 * loading and the single preferences PUT are used by Account, Preferences,
 * Notifications and Personalization, so they live here instead of being
 * duplicated four times. The logic is the page's original implementation,
 * moved verbatim — same optimistic update, same revert, same toasts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { PROFILE_KEY, refreshProfile } from '@/hooks/useUserProfile';
import { DISCLOSURE_KEY } from '@/lib/hooks/useFeatureDisclosure';
import type { UserProfile } from '@/types/user.types';
import type { SupportedLocale } from '@/i18n/routing';

export type SettingsProfileStatus = 'loading' | 'failed' | 'ready';

export type PreferenceField =
  | 'currency_format'
  | 'date_format'
  | 'weekly_digest_enabled'
  | 'gamification_enabled'
  | 'disclosure_show_all'
  | 'push_nudges_enabled'
  | 'push_milestones_enabled'
  | 'push_household_enabled'
  | 'push_digest_enabled'
  | 'push_reengagement_enabled'
  | 'quiet_hours_start'
  | 'quiet_hours_end';

export function useSettingsProfile() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const t = useTranslations('settings');

  // Hydration guard. The original page rendered a spinner until mounted so the
  // server and client trees matched; splitting into sub-pages dropped it and
  // reintroduced the mismatch (client-only state: cookies, push/browser APIs).
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Direct fetch — completely bypasses SWR cache to guarantee fresh API data.
  // SWR cache deduplication was preventing the fetcher from ever running.
  //
  // The cache is still read ONCE for the initial value: every sub-page remounts
  // this hook, and starting from null meant a full-card spinner on every single
  // navigation between settings groups. Seeding from the cache the hook itself
  // populated makes re-entry instant while the revalidating fetch still runs.
  const { cache } = useSWRConfig();
  const cachedProfile = useRef<UserProfile | null>(
    (cache.get(PROFILE_KEY)?.data as UserProfile | undefined) ?? null
  ).current;

  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
  const [isLoading, setIsLoading] = useState(cachedProfile === null);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      setError(null);
      const res = await fetch('/api/user/profile');
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Unexpected response format');
      const json = await res.json();
      if (signal?.cancelled) return;
      if (!json.data) throw new Error('Profile response contained no data');
      setProfile(json.data);
      // Also update SWR cache so Header picks up the fresh data
      mutate(PROFILE_KEY, json.data, false);
    } catch (err) {
      if (!signal?.cancelled) setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      if (!signal?.cancelled) setIsLoading(false);
    }
  }, [mutate]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadProfile(signal);
    return () => {
      signal.cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [displayName, setDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // DERIVED, not mirrored into state. These used to be `useState` defaults kept
  // in sync by an effect, which lagged the profile by exactly one render — the
  // render on which the gate first opens. A user on USD who clicked Export on
  // that frame got a report formatted in EUR. The mirror also never reverted:
  // when a PUT failed, `profile` rolled back but the mirrored value kept the
  // value that failed to save, so the control lied about what was stored.
  //
  // Deriving gives both for free: no lag, and the optimistic update / rollback
  // in updatePreference is the single source of truth.
  const prefs = profile?.preferences;
  const currencyFormat: 'USD' | 'EUR' | 'GBP' = prefs?.currency_format ?? 'EUR';
  const dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' = prefs?.date_format ?? 'MM/DD/YYYY';
  const weeklyDigestEnabled = prefs?.weekly_digest_enabled ?? true;
  const gamificationEnabled = prefs?.gamification_enabled ?? true;
  const showAllFeatures = prefs?.disclosure_show_all ?? false;

  const language: SupportedLocale =
    typeof document !== 'undefined'
      ? ((document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] as SupportedLocale) || 'en')
      : 'en';

  // displayName stays local state: it is a free-text field the user edits
  // between saves, so it cannot be derived. Seed it when the profile arrives.
  useEffect(() => {
    if (profile) setDisplayName(profile.display_name || '');
  }, [profile]);

  // AC-8.3.2, AC-8.3.6, AC-8.3.7: Update profile with optimistic UI
  const updateProfile = useCallback(async () => {
    if (!profile) return;

    setIsSavingProfile(true);

    try {
      const optimisticProfile = { ...profile, display_name: displayName };
      setProfile(optimisticProfile);
      mutate(PROFILE_KEY, optimisticProfile, false);

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const result = await response.json();
      if (result.data) {
        setProfile(result.data);
        mutate(PROFILE_KEY, result.data, false);
        refreshProfile();
      }

      toast({ title: t('profileUpdated'), status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      console.error('Error updating profile:', err);

      // Revert optimistic update
      setProfile(profile);
      mutate(PROFILE_KEY, profile, false);
      refreshProfile();

      toast({
        title: t('profileUpdateFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingProfile(false);
    }
  }, [profile, displayName, mutate, toast, t]);

  // AC-8.3.5, AC-8.3.6, AC-8.3.7: Update preferences
  const updatePreference = useCallback(
    async (field: PreferenceField, value: string | boolean | number) => {
      if (!profile) return;

      try {
        const optimisticProfile = {
          ...profile,
          preferences: { ...profile.preferences, [field]: value },
        };
        setProfile(optimisticProfile);
        mutate(PROFILE_KEY, optimisticProfile, false);

        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: { [field]: value } }),
        });

        if (!response.ok) {
          throw new Error('Failed to update preferences');
        }

        const result = await response.json();
        if (result.data) {
          setProfile(result.data);
          mutate(PROFILE_KEY, result.data, false);
          refreshProfile();
        }

        // Story 15.7: disclosure_show_all is consumed by the disclosure GET
        // server-side, so revalidate that key on flip (the profile mutate above
        // does not reach it).
        if (field === 'disclosure_show_all') {
          mutate(DISCLOSURE_KEY, undefined, { revalidate: true });
        }

        toast({
          title: t('preferencesUpdated'),
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (err) {
        console.error('Error updating preferences:', err);

        // Revert optimistic update
        setProfile(profile);
        mutate(PROFILE_KEY, profile, false);
        refreshProfile();

        toast({
          title: t('preferencesUpdateFailed'),
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [profile, mutate, toast, t]
  );

  // AC-10.1.4, AC-10.1.5: Update language preference and persist
  const updateLanguage = useCallback(async (newLocale: SupportedLocale) => {
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { language: newLocale } }),
      });
    } catch (err) {
      console.error('Error saving language preference:', err);
    }
  }, []);

  // Mirrors the three branches the pre-split page rendered at the top of the
  // screen. 'failed' must be distinct from 'loading': the fetch clears
  // isLoading on the error path too, so a boolean-only gate opens onto a null
  // profile — a UI that shows hardcoded defaults as if they were the user's
  // saved settings and silently discards every write (both save actions
  // early-return when profile is null).
  const status: SettingsProfileStatus =
    !hasMounted || isLoading ? 'loading' : error || !profile ? 'failed' : 'ready';

  return {
    profile,
    isLoading,
    error,
    /** Server and first client render must agree — gate profile-driven UI on this. */
    status,
    /** Re-fetch after a mutation this hook did not perform (e.g. picture upload). */
    reload: loadProfile,
    // form state
    displayName,
    setDisplayName,
    isSavingProfile,
    currencyFormat,
    dateFormat,
    weeklyDigestEnabled,
    gamificationEnabled,
    showAllFeatures,
    language,
    // actions
    updateProfile,
    updatePreference,
    updateLanguage,
  };
}
