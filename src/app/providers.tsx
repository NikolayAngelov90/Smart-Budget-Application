'use client';

import { useEffect } from 'react';
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

export function Providers({ children }: { children: React.ReactNode}) {
  // AC-10.1.6: Detect browser language on first visit
  useEffect(() => {
    detectAndSetLocale();
  }, []);

  return (
    <ChakraProvider theme={theme}>
      <SWRConfig
        value={{
          provider: localStorageProvider,
          revalidateOnFocus: true,
          revalidateOnReconnect: true,
          dedupingInterval: 2000,
        }}
      >
        <PWAAnalyticsProvider>{children}</PWAAnalyticsProvider>
      </SWRConfig>
    </ChakraProvider>
  );
}
