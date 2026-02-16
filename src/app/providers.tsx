'use client';

import { useEffect, useState } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import theme from '@/theme';
import { localStorageProvider } from '@/lib/swr/localStorageProvider';
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
 * SWR configuration values.
 * The localStorage provider is deferred until after hydration to prevent
 * React error #418 (server/client HTML mismatch).
 */
const SWR_OPTIONS_BASE = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
};

export function Providers({ children }: { children: React.ReactNode}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // AC-10.1.6: Detect browser language on first visit
  useEffect(() => {
    detectAndSetLocale();
  }, []);

  // Only attach the localStorage provider after first client render
  // to avoid hydration mismatch (server has no localStorage data).
  const swrValue = hasMounted
    ? { ...SWR_OPTIONS_BASE, provider: localStorageProvider }
    : SWR_OPTIONS_BASE;

  return (
    <ChakraProvider theme={theme}>
      <SWRConfig value={swrValue}>
        <PWAAnalyticsProvider>{children}</PWAAnalyticsProvider>
      </SWRConfig>
    </ChakraProvider>
  );
}
