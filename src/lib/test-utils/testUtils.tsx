/**
 * Test Utilities - Main Entry Point
 * Provides renderWithProviders function with all 6 provider layers
 */

import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ChakraTestProvider } from './mockChakra';
import {
  createMockSupabaseClient,
  createMockSupabaseAuth,
  mockUser,
  mockSession,
} from './mockSupabase';
import { createMockRouter, defaultMockRouter } from './mockRouter';
import { createMockSWRConfig } from './mockSWR';
import { createMockToast } from './mockToast';
import type { CustomRenderOptions, RenderResult } from './types';

/**
 * Custom render function that wraps components with all necessary providers
 *
 * Provides:
 * 1. Chakra UI Provider (theming and UI components)
 * 2. SWR Config (data fetching)
 * 3. Supabase Client Mock (database queries)
 * 4. Supabase Auth Mock (authentication)
 * 5. Next.js Router Mock (navigation)
 * 6. Toast Mock (notifications)
 *
 * @example
 * ```typescript
 * import { renderWithProviders, screen } from '@/lib/test-utils';
 *
 * test('renders component', () => {
 *   const { mockSupabase } = renderWithProviders(<MyComponent />);
 *
 *   // Customize mocks
 *   mockSupabase.select.mockResolvedValue({
 *     data: [{ id: 1, name: 'Test' }],
 *     error: null
 *   });
 *
 *   // Test your component
 *   expect(screen.getByText('My Component')).toBeInTheDocument();
 * });
 * ```
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const {
    mockSupabase: mockSupabaseOverrides,
    mockAuth: mockAuthOverrides,
    mockRouter: mockRouterOverrides,
    mockUser: customUser,
    mockSession: customSession,
    ...renderOptions
  } = options;

  // Create mocks with custom overrides
  const mockSupabase = createMockSupabaseClient(mockSupabaseOverrides);
  const mockAuth = createMockSupabaseAuth(
    customUser !== undefined ? customUser : mockUser,
    customSession !== undefined ? customSession : mockSession,
    mockAuthOverrides
  );
  const mockRouter = mockRouterOverrides
    ? createMockRouter(mockRouterOverrides)
    : defaultMockRouter;
  const mockToast = createMockToast();

  // Mock next/navigation hooks
  jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
  }));

  // Mock Supabase client (using @supabase/ssr)
  jest.mock('@supabase/ssr', () => ({
    createBrowserClient: jest.fn(() => ({
      ...mockSupabase,
      auth: mockAuth,
    })),
  }));

  // Mock Chakra UI's useToast hook (toast is provided via ChakraProvider context)
  // Note: Chakra toast mocking is handled in mockChakra.tsx via useToast mock

  // Configure SWR for testing
  const swrConfig = createMockSWRConfig();

  // Create wrapper component with all providers
  const AllProviders: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => {
    return (
      <ChakraTestProvider>
        <SWRConfig value={swrConfig}>{children}</SWRConfig>
      </ChakraTestProvider>
    );
  };

  // Render with Testing Library
  const renderResult = rtlRender(ui, {
    wrapper: AllProviders,
    ...renderOptions,
  });

  // Return extended render result with attached mocks
  return {
    ...renderResult,
    mockSupabase,
    mockAuth,
    mockRouter,
    mockToast,
  } as RenderResult;
}

/**
 * Re-export render as renderWithProviders for convenience
 * This allows: import { render } from '@/lib/test-utils'
 */
export { renderWithProviders as render };
