/**
 * Custom render function with all necessary providers
 * Use this instead of @testing-library/react's render
 */

import React from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { SWRConfig } from 'swr'
import theme from '@/theme'

interface AllTheProvidersProps {
  children: React.ReactNode
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <ChakraProvider theme={theme}>
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
        }}
      >
        {children}
      </SWRConfig>
    </ChakraProvider>
  )
}

function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
export { default as userEvent } from '@testing-library/user-event'
