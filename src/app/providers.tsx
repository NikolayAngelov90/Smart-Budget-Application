'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import theme from '@/theme';
import { localStorageProvider } from '@/lib/swr/localStorageProvider';
import { usePWAAnalytics } from '@/hooks/usePWAAnalytics';

/**
 * PWA Analytics wrapper component
 * Story 9-5: Initializes PWA event tracking at app root
 */
function PWAAnalyticsProvider({ children }: { children: React.ReactNode }) {
  usePWAAnalytics();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode}) {
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
