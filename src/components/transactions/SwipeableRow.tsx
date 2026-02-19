'use client';

/**
 * SwipeableRow Component
 * Story 10-8: Mobile-Optimized Touch UI
 *
 * AC-10.8.3: Swipe-left on a transaction row reveals a Delete action;
 *             swipe-right reveals an Edit action.
 *
 * - Raw touch events — no gesture library required.
 * - CSS translateX for reveal animation; snap-back if swipe < threshold.
 * - Gesture state stored in useRef to avoid re-renders during swiping.
 * - Desktop: no swipe behavior (mouse events don't fire Touch events).
 */

import { useRef, useCallback } from 'react';
import { Box, IconButton } from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';

const SWIPE_THRESHOLD = 60; // px needed to reveal an action
const SNAP_BACK_DURATION = '0.2s';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit: () => void;
}

export function SwipeableRow({ children, onDelete, onEdit }: SwipeableRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  const applyTransform = useCallback((x: number, animate: boolean) => {
    const row = rowRef.current;
    if (!row) return;
    row.style.transition = animate ? `transform ${SNAP_BACK_DURATION} ease` : 'none';
    row.style.transform = `translateX(${x}px)`;
  }, []);

  const snapBack = useCallback(() => {
    currentXRef.current = 0;
    applyTransform(0, true);
    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, [applyTransform]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    directionLockedRef.current = null;
    isSwipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      // Lock direction on first significant move
      if (directionLockedRef.current === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          directionLockedRef.current = 'vertical';
        } else {
          directionLockedRef.current = 'horizontal';
        }
      }

      // Only handle horizontal swipes
      if (directionLockedRef.current !== 'horizontal') return;

      e.preventDefault();
      isSwipingRef.current = true;

      // Clamp to reasonable range: -120px (delete left) to +120px (edit right)
      const clampedX = Math.max(-120, Math.min(120, deltaX));
      currentXRef.current = clampedX;
      applyTransform(clampedX, false);
    },
    [applyTransform]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;

    const x = currentXRef.current;

    if (x < -SWIPE_THRESHOLD) {
      // Swiped left past threshold → reveal delete (snap to -80px reveal position)
      applyTransform(-80, true);
      currentXRef.current = -80;
    } else if (x > SWIPE_THRESHOLD) {
      // Swiped right past threshold → reveal edit (snap to +80px reveal position)
      applyTransform(80, true);
      currentXRef.current = 80;
    } else {
      // Below threshold → snap back
      snapBack();
    }

    isSwipingRef.current = false;
    directionLockedRef.current = null;
  }, [applyTransform, snapBack]);

  const handleDeleteTap = useCallback(() => {
    snapBack();
    onDelete();
  }, [snapBack, onDelete]);

  const handleEditTap = useCallback(() => {
    snapBack();
    onEdit();
  }, [snapBack, onEdit]);

  return (
    <Box position="relative" overflow="hidden" borderRadius="md">
      {/* Delete action (behind row on the right side, revealed by swiping left) */}
      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        w="80px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="red.500"
        borderRadius="md"
        aria-label="Delete action"
      >
        <IconButton
          aria-label="Delete transaction"
          icon={<DeleteIcon />}
          colorScheme="red"
          variant="ghost"
          color="white"
          minH="48px"
          minW="48px"
          _hover={{ bg: 'red.600' }}
          onClick={handleDeleteTap}
        />
      </Box>

      {/* Edit action (behind row on the left side, revealed by swiping right) */}
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        w="80px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="blue.500"
        borderRadius="md"
        aria-label="Edit action"
      >
        <IconButton
          aria-label="Edit transaction"
          icon={<EditIcon />}
          colorScheme="blue"
          variant="ghost"
          color="white"
          minH="48px"
          minW="48px"
          _hover={{ bg: 'blue.600' }}
          onClick={handleEditTap}
        />
      </Box>

      {/* The actual row content (slides left/right on swipe) */}
      <Box
        ref={rowRef}
        position="relative"
        zIndex={1}
        bg="white"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // Clicking anywhere on the row while revealed snaps it back
        onClick={() => {
          if (Math.abs(currentXRef.current) > 10) {
            snapBack();
          }
        }}
        userSelect="none"
      >
        {children}
      </Box>
    </Box>
  );
}
