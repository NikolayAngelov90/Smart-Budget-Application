'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { SWRConfig } from 'swr';
import theme from '@/theme';
import { localStorageProvider } from '@/lib/swr/localStorageProvider';

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
        {children}
      </SWRConfig>
    </ChakraProvider>
  );
}
