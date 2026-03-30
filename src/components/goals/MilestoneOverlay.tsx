'use client';

/**
 * MilestoneOverlay Component
 * Story 11.6: Goal Milestone Celebrations
 *
 * Full-screen celebration modal displayed when a savings goal reaches a milestone.
 * Auto-dismisses after 4 seconds. Supports reduced-motion accessibility.
 */

import { useEffect, useMemo } from 'react';
import {
  Badge,
  Box,
  Button,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
  VisuallyHidden,
} from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

// ============================================================================
// CONFETTI
// ============================================================================

const CONFETTI_COLORS = ['#4299E1', '#48BB78', '#F6AD55', '#FC8181', '#B794F4', '#76E4F7', '#F687B3'];

function generateConfettiPieces() {
  return Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: `${Math.floor(Math.random() * 85 + 5)}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    delay: parseFloat((Math.random() * 1.2).toFixed(2)),
  }));
}

// ============================================================================
// HELPERS
// ============================================================================

function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ============================================================================
// PROPS
// ============================================================================

interface MilestoneOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: number;
  goalName: string;
  currentAmount: number;
  currency: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MilestoneOverlay({
  isOpen,
  onClose,
  milestone,
  goalName,
  currentAmount,
  currency,
}: MilestoneOverlayProps) {
  const t = useTranslations('goals');
  const reducedMotion = useReducedMotion();
  // L2: fresh random positions each time this component mounts
  const confettiPieces = useMemo(() => generateConfettiPieces(), []);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  const emoji = milestone === 100 ? '🏆' : '🎯';
  const isComplete = milestone === 100;

  return (
    <>
      {/* H1: live region always in DOM (empty when closed) so screen readers
          observe a content *change* rather than a newly-mounted region. */}
      <VisuallyHidden>
        <span aria-live="assertive" aria-atomic="true">
          {isOpen
            ? `${isComplete ? t('milestoneComplete') : t('milestoneTitle')} ${t('milestoneMessage', { goalName, percentage: milestone })}`
            : ''}
        </span>
      </VisuallyHidden>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay />
      <ModalContent position="relative" overflow="hidden" data-testid="milestone-overlay">
        {/* Confetti animation — hidden when reduced motion is preferred */}
        {!reducedMotion && (
          <Box position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="none">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  left: piece.left,
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: piece.color,
                }}
                animate={{ y: '100vh', rotate: 720, opacity: 0 }}
                initial={{ y: '-10px', rotate: 0, opacity: 1 }}
                transition={{ duration: 2, ease: 'linear', delay: piece.delay }}
              />
            ))}
          </Box>
        )}

        {/* Reduced motion: instant badge (L1: duration 0 — no animation) */}
        {reducedMotion && (
          <Box display="flex" justifyContent="center" pt={4}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0 }}
            >
              <Badge colorScheme="purple" fontSize="lg" px={3} py={1}>
                {milestone}%
              </Badge>
            </motion.div>
          </Box>
        )}

        <ModalBody textAlign="center" pt={reducedMotion ? 4 : 8} pb={4}>
          <Text fontSize="4xl" mb={2}>{emoji}</Text>

          <Heading size="4xl" mb={2}>
            {milestone}%
          </Heading>

          <Text fontSize="lg" fontWeight="semibold" mb={1}>
            {isComplete ? t('milestoneComplete') : t('milestoneTitle')}
          </Text>

          <Text color="gray.600" mb={2}>
            {t('milestoneMessage', { goalName, percentage: milestone })}
          </Text>

          <Text fontSize="sm" color="gray.500">
            {t('milestoneAmount', { amount: formatAmount(currentAmount, currency) })}
          </Text>
        </ModalBody>

        <ModalFooter justifyContent="center" pt={0}>
          <Button variant="ghost" colorScheme="blue" onClick={onClose}>
            {t('milestoneDismiss')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
}
