'use client';

/**
 * AchievementsSection — Story 15.3 (FR30)
 *
 * Badge gallery in Settings (UX: "Profile/settings section", responsive
 * 4/3/2-column grid, no new top-level nav). ALL catalog entries are always
 * visible — locked tiles show the condition as motivation (deliberately NO
 * progressive-disclosure null gate, unlike StreakBadge/BudgetScoreRing).
 * Unlocked: gold badge + unlock date. Gold = UX token #D69E2E.
 */

import { Badge, Box, Heading, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { ACHIEVEMENTS } from '@/lib/ai/achievementCatalog';
import { useAchievements } from '@/lib/hooks/useAchievements';
import type { UserAchievement } from '@/types/database.types';

const ACHIEVEMENT_GOLD = '#D69E2E';

export function AchievementsSection() {
  const t = useTranslations('achievements');
  // Locale-aware unlock dates — "Отключено на Jul 1, 2026" is not a sentence (15-3 review)
  const locale = useLocale();
  const dateLocale = locale === 'bg' ? bg : undefined;
  const { data } = useAchievements();

  const unlockedByKey = new Map<string, UserAchievement>(
    (data?.achievements ?? []).map((a) => [a.achievement_key, a])
  );

  return (
    <Box as="section" aria-label={t('heading')}>
      <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700" mb={4}>
        {t('heading')}
      </Heading>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
        {ACHIEVEMENTS.map(({ key }) => {
          const unlock = unlockedByKey.get(key);
          const name = t(`names.${key}`);
          const unlockedLabel = unlock
            ? t('unlockedOn', {
                date: format(new Date(unlock.unlocked_at), 'MMM d, yyyy', { locale: dateLocale }),
              })
            : null;
          return (
            <VStack
              key={key}
              align="flex-start"
              spacing={1}
              p={3}
              borderWidth="2px"
              borderRadius="lg"
              borderColor={unlock ? ACHIEVEMENT_GOLD : 'gray.200'}
              bg={unlock ? 'yellow.50' : 'gray.50'}
              opacity={unlock ? 1 : 0.75}
              aria-label={unlockedLabel ? `${name}, ${unlockedLabel}` : `${name}, ${t('locked')}`}
            >
              <Text aria-hidden="true" fontSize="2xl" lineHeight="1" filter={unlock ? undefined : 'grayscale(1)'}>
                🏅
              </Text>
              <Text fontSize="sm" fontWeight={600} color={unlock ? 'gray.800' : 'gray.600'}>
                {name}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {t(`conditions.${key}`)}
              </Text>
              {unlockedLabel ? (
                <Badge bg={ACHIEVEMENT_GOLD} color="white" borderRadius="full" px={2} fontSize="0.65rem">
                  {unlockedLabel}
                </Badge>
              ) : (
                <Badge variant="outline" colorScheme="gray" borderRadius="full" px={2} fontSize="0.65rem">
                  {t('locked')}
                </Badge>
              )}
            </VStack>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
