/**
 * FloatingActionButton (FAB) Component
 * Story 3.1: Quick Transaction Entry Modal
 *
 * A floating action button fixed in the bottom-right corner
 * Always accessible for quick transaction entry (most frequent action)
 *
 * Features:
 * - Fixed positioning (bottom-right)
 * - 60x60px size with Trust Blue color
 * - "+" icon
 * - Hover/active states with elevation changes
 * - Opens transaction entry modal on click
 * - Fully keyboard accessible
 * - 44x44px minimum touch target (mobile)
 * - ARIA labeled for screen readers
 *
 * Usage:
 * <FloatingActionButton onClick={() => setModalOpen(true)} />
 */

'use client';

import { IconButton, Icon } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';

interface FloatingActionButtonProps {
  /**
   * Click handler - typically opens transaction entry modal
   */
  onClick: () => void;

  /**
   * Optional aria-label override
   * @default "Add transaction"
   */
  ariaLabel?: string;
}

export default function FloatingActionButton({
  onClick,
  ariaLabel = 'Add transaction',
}: FloatingActionButtonProps) {
  return (
    <IconButton
      aria-label={ariaLabel}
      icon={<Icon as={AddIcon} boxSize={6} />}
      onClick={onClick}
      // Positioning
      position="fixed"
      bottom={{ base: '20px', md: '32px' }}
      right={{ base: '20px', md: '32px' }}
      zIndex={1000}
      // Size
      size="lg"
      w="60px"
      h="60px"
      minW="60px"
      minH="60px"
      // Trust Blue theme colors
      bg="#2b6cb0"
      color="white"
      // Border radius (circular)
      borderRadius="full"
      // Shadow for elevation
      boxShadow="0 4px 12px rgba(43, 108, 176, 0.4)"
      // Hover state
      _hover={{
        bg: '#2c5282',
        transform: 'scale(1.05)',
        boxShadow: '0 6px 16px rgba(43, 108, 176, 0.5)',
      }}
      // Active state
      _active={{
        bg: '#2c5282',
        transform: 'scale(0.98)',
        boxShadow: '0 2px 8px rgba(43, 108, 176, 0.3)',
      }}
      // Focus state (keyboard accessibility)
      _focus={{
        outline: '2px solid #4299e1',
        outlineOffset: '2px',
      }}
      // Smooth transitions
      transition="all 0.2s ease-in-out"
      // Accessibility
      role="button"
      tabIndex={0}
    />
  );
}
