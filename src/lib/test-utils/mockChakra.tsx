/**
 * Chakra UI Mock Utilities
 * Provides ChakraProvider wrapper for tests
 */

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';

/**
 * Chakra test provider component
 * Wraps components with ChakraProvider using the app's theme
 *
 * @example
 * ```typescript
 * import { ChakraTestProvider } from '@/lib/test-utils/mockChakra';
 *
 * render(
 *   <ChakraTestProvider>
 *     <MyComponent />
 *   </ChakraTestProvider>
 * );
 * ```
 */
export const ChakraTestProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <ChakraProvider>{children}</ChakraProvider>;
};

/**
 * Mock Chakra UI's useToast hook
 * Returns a jest mock function that can be customized in tests
 */
export function createMockToast() {
  return jest.fn();
}

/**
 * Mock Chakra UI's useDisclosure hook
 * Returns controllable disclosure state for testing modals/drawers
 */
export function createMockDisclosure(initialOpen = false) {
  return {
    isOpen: initialOpen,
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onToggle: jest.fn(),
    isControlled: false,
    getButtonProps: jest.fn(),
    getDisclosureProps: jest.fn(),
  };
}

/**
 * Mock Chakra UI's useColorMode hook
 * Returns controllable color mode state for testing dark/light modes
 */
export function createMockColorMode(initialMode: 'light' | 'dark' = 'light') {
  return {
    colorMode: initialMode,
    toggleColorMode: jest.fn(),
    setColorMode: jest.fn(),
  };
}
