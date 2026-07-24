'use client';

import { useEffect, useRef } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig, useSWRConfig } from 'swr';
import theme from '@/theme';
import { localStorageProvider, loadPersistedEntries } from '@/lib/swr/localStorageProvider';
import { usePWAAnalytics } from '@/hooks/usePWAAnalytics';
import { detectAndSetLocale } from '@/i18n/detectLocale';

/**
 * PWA Analytics wrapper component
 * Story 9-5: Initializes PWA event tracking at app root
 */
function PWAAnalyticsProvider({ children }: { children: React.ReactNode }) {
  usePWAAnalytics();
  return <>{children}</>;
}

/**
 * SWR configuration.
 *
 * The localStorage provider is attached from the FIRST render and never swapped.
 * Its map starts empty (matching the server, so no React #418 hydration
 * mismatch); persisted data is re-seeded after mount by `CacheHydrator`.
 *
 * This replaces the previous "attach the provider only after mount" approach,
 * which swapped the SWR cache mid-lifecycle and orphaned any request already
 * in flight from the first render — a full-page load / refresh of a data page
 * (most visibly /categories) then hung on its loading state forever even though
 * the API had returned 200.
 */
const SWR_OPTIONS = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  provider: localStorageProvider,
};

/**
 * Seeds the live SWR cache with the localStorage-persisted entries once, after
 * mount. Runs in an effect (never during hydration) so the first paint still
 * matches the server. Skips any key that already holds data so a fresh fetch
 * started on mount is never clobbered by stale cached data.
 */
function CacheHydrator({ children }: { children: React.ReactNode }) {
  const { cache, mutate } = useSWRConfig();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    for (const [key, state] of loadPersistedEntries()) {
      const current = cache.get(key);
      const hasLiveData = current && current.data !== undefined;
      if (!hasLiveData && state && state.data !== undefined) {
        // Seed the cached data AND revalidate. `revalidate: true` matters: any
        // mutate discards a request already in flight for the key (SWR race
        // protection), so a fresh fetch must be kicked off here or the consumer
        // would be stuck on stale cached data until the next focus/reconnect.
        mutate(key, state.data, { revalidate: true });
      }
    }
  }, [cache, mutate]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // AC-10.1.6: Detect browser language on first visit
  useEffect(() => {
    detectAndSetLocale();
  }, []);

  return (
    <ChakraProvider theme={theme}>
      <SWRConfig value={SWR_OPTIONS}>
        <CacheHydrator>
          <PWAAnalyticsProvider>{children}</PWAAnalyticsProvider>
        </CacheHydrator>
      </SWRConfig>
    </ChakraProvider>
  );
}
