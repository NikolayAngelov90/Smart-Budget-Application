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

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { PROFILE_KEY, refreshProfile } from '@/hooks/useUserProfile';
import { DISCLOSURE_KEY } from '@/lib/hooks/useFeatureDisclosure';
import type { UserProfile } from '@/types/user.types';
import type { SupportedLocale } from '@/i18n/routing';

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error('Unexpected response format');
        const json = await res.json();
        if (!cancelled && json.data) {
          setProfile(json.data);
          // Also update SWR cache so Header picks up the fresh data
          mutate(PROFILE_KEY, json.data, false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Form state, initialised from the loaded profile
  const [displayName, setDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currencyFormat, setCurrencyFormat] = useState<'USD' | 'EUR' | 'GBP'>('EUR');
  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'>(
    'MM/DD/YYYY'
  );
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
  const [gamificationEnabled, setGamificationEnabled] = useState(true);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const language: SupportedLocale =
    typeof document !== 'undefined'
      ? ((document.cookie.match(/NEXT_LOCALE=(\w+)/)?.[1] as SupportedLocale) || 'en')
      : 'en';

  useEffect(() => {
    if (profile?.preferences) {
      setDisplayName(profile.display_name || '');
      setCurrencyFormat(profile.preferences.currency_format);
      setDateFormat(profile.preferences.date_format);
      setWeeklyDigestEnabled(profile.preferences.weekly_digest_enabled ?? true);
      setGamificationEnabled(profile.preferences.gamification_enabled ?? true);
      setShowAllFeatures(profile.preferences.disclosure_show_all ?? false);
    }
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

  return {
    profile,
    isLoading,
    error,
    /** Server and first client render must agree — gate profile-driven UI on this. */
    isReady: hasMounted && !isLoading,
    // form state
    displayName,
    setDisplayName,
    isSavingProfile,
    currencyFormat,
    setCurrencyFormat,
    dateFormat,
    setDateFormat,
    weeklyDigestEnabled,
    setWeeklyDigestEnabled,
    gamificationEnabled,
    setGamificationEnabled,
    showAllFeatures,
    setShowAllFeatures,
    language,
    // actions
    updateProfile,
    updatePreference,
    updateLanguage,
  };
}
