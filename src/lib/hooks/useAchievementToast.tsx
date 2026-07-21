'use client';

/**
 * useAchievementToast — Story 15.3 (FR30)
 *
 * Returns a stable callback that fires celebration toasts for newly unlocked
 * achievement keys. UX feedback table: toast + badge icon, ~5s auto-dismiss;
 * Chakra's toast wrapper provides the polite live region (role="status" +
 * aria-atomic) around custom renders — satisfies AC2 (achievements announced).
 * KNOWN LIMITATION (15-3 review, accepted for 15-8 AC3): the toast's
 * framer-motion slide-in does NOT honor prefers-reduced-motion — Chakra v2
 * ships no reduced-motion branch for toasts. This DEGRADES GRACEFULLY per AC3:
 * only the entrance animates; the content is fully readable and announced
 * regardless, and nothing breaks. Hand-rolling toast motion was explicitly
 * NOT authorized (15-3), so the platform default stands.
 * Gold = UX `gamification.achievement` token #D69E2E.
 *
 * Batch cap (15-3 review): more than MAX_INDIVIDUAL_TOASTS keys at once (the
 * deploy-day backfill case — an established user can earn 5+ retroactively)
 * collapses into ONE summary toast instead of a stacked flood.
 */

import { useCallback } from 'react';
import { Box, HStack, Text, useToast } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useGamification } from '@/lib/hooks/useGamification';
import type { AchievementKey } from '@/types/database.types';

const ACHIEVEMENT_GOLD = '#D69E2E';
const MAX_INDIVIDUAL_TOASTS = 3;

export function useAchievementToast(): (keys: AchievementKey[] | undefined) => void {
  const toast = useToast();
  const t = useTranslations('achievements');
  // Story 15.6: single gating point for BOTH call sites (TransactionEntryModal
  // + BudgetScoreRing) — opted-out users get no achievement celebrations
  const { enabled } = useGamification();

  return useCallback(
    (keys) => {
      if (!enabled) return;
      if (!keys || keys.length === 0) return;

      if (keys.length > MAX_INDIVIDUAL_TOASTS) {
        toast({
          duration: 5000,
          isClosable: true,
          position: 'top-right',
          render: ({ onClose }) => (
            <Box
              bg="white"
              borderWidth="2px"
              borderColor={ACHIEVEMENT_GOLD}
              borderRadius="lg"
              boxShadow="lg"
              px={4}
              py={3}
              onClick={onClose}
              cursor="pointer"
            >
              <HStack spacing={3} align="flex-start">
                <Text aria-hidden="true" fontSize="2xl" lineHeight="1">
                  🏅
                </Text>
                <Box>
                  <Text fontWeight={700} color={ACHIEVEMENT_GOLD} fontSize="sm">
                    {t('toastTitle')}
                  </Text>
                  <Text fontWeight={600} fontSize="sm">
                    {t('toastBatch', { count: keys.length })}
                  </Text>
                </Box>
              </HStack>
            </Box>
          ),
        });
        return;
      }

      for (const key of keys) {
        toast({
          duration: 5000,
          isClosable: true,
          position: 'top-right',
          render: ({ onClose }) => (
            <Box
              bg="white"
              borderWidth="2px"
              borderColor={ACHIEVEMENT_GOLD}
              borderRadius="lg"
              boxShadow="lg"
              px={4}
              py={3}
              onClick={onClose}
              cursor="pointer"
            >
              <HStack spacing={3} align="flex-start">
                <Text aria-hidden="true" fontSize="2xl" lineHeight="1">
                  🏅
                </Text>
                <Box>
                  <Text fontWeight={700} color={ACHIEVEMENT_GOLD} fontSize="sm">
                    {t('toastTitle')}
                  </Text>
                  <Text fontWeight={600} fontSize="sm">
                    {t(`names.${key}`)}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {t(`conditions.${key}`)}
                  </Text>
                </Box>
              </HStack>
            </Box>
          ),
        });
      }
    },
    [toast, t, enabled]
  );
}
