'use client';

/**
 * useAchievementToast — Story 15.3 (FR30)
 *
 * Returns a stable callback that fires one celebration toast per newly
 * unlocked achievement key. UX feedback table: toast + badge icon, ~5s
 * auto-dismiss; Chakra toasts announce via role="status" (aria-live polite)
 * and Chakra handles prefers-reduced-motion internally — no hand-rolled
 * animation. Gold = UX `gamification.achievement` token #D69E2E.
 */

import { useCallback } from 'react';
import { Box, HStack, Text, useToast } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { AchievementKey } from '@/types/database.types';

const ACHIEVEMENT_GOLD = '#D69E2E';

export function useAchievementToast(): (keys: AchievementKey[] | undefined) => void {
  const toast = useToast();
  const t = useTranslations('achievements');

  return useCallback(
    (keys) => {
      if (!keys || keys.length === 0) return;
      for (const key of keys) {
        toast({
          duration: 5000,
          isClosable: true,
          position: 'top-right',
          render: ({ onClose }) => (
            <Box
              role="status"
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
    [toast, t]
  );
}
