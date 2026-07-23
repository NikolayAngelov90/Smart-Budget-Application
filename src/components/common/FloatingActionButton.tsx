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

import { IconButton, Icon, Tooltip } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

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
  // Story 8.5 AC-8.5.3: Disable mutations when offline
  const { isOnline } = useOnlineStatus();

  return (
    <Tooltip
      label={!isOnline ? 'Available when online' : ariaLabel}
      placement="left"
      hasArrow
    >
      <IconButton
        aria-label={ariaLabel}
        icon={<Icon as={AddIcon} boxSize={6} />}
        onClick={onClick}
        isDisabled={!isOnline}
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
        // Quiet Ledger: evergreen squircle, matching the mobile bottom-nav Add tab.
        bg="accent"
        color="white"
        borderRadius="20px"
        boxShadow="accent"
        // Hover state
        _hover={{
          bg: isOnline ? 'accent.emphasis' : 'accent',
          transform: isOnline ? 'translateY(-2px) scale(1.04)' : 'none',
          boxShadow: isOnline ? 'lg' : 'accent',
        }}
        // Active state
        _active={{
          bg: isOnline ? 'evergreen.700' : 'accent',
          transform: isOnline ? 'scale(0.97)' : 'none',
        }}
        // Focus state (keyboard accessibility)
        _focusVisible={{
          boxShadow: 'focus',
        }}
        // Smooth transitions
        transition="all 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
        // Accessibility
        role="button"
        tabIndex={0}
        opacity={!isOnline ? 0.5 : 1}
      />
    </Tooltip>
  );
}
