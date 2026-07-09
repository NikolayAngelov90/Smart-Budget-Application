'use client';

/**
 * StreakBadge Component — Story 15.1 (FR28)
 *
 * Compact daily/weekly logging streak display for the dashboard header.
 * Single mount point by design: Story 15.6's gamification opt-out will gate
 * exactly this component. Progressive disclosure — renders null until the
 * user has streak data. Status is conveyed by text + icons, never color
 * alone (15-8 groundwork).
 */

import { Box, HStack, Text, Tooltip, VisuallyHidden } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useStreak } from '@/lib/hooks/useStreak';
import { isFreezeAvailable, isoWeekKey } from '@/lib/ai/streakEngine';

export function StreakBadge() {
  const t = useTranslations('streaks');
  const { data } = useStreak();

  // Progressive disclosure: nothing until the first log creates streak state.
  // Errors stay quiet — keepPreviousData holds the last known streak.
  const streak = data?.streak;
  if (!streak || streak.current_streak <= 0) return null;

  // The engine sets freeze_used_on to the log day it bridged INTO — when that
  // matches the last counted day, the most recent advance was a freeze.
  const freezeJustUsed =
    streak.freeze_used_on !== null && streak.freeze_used_on === streak.last_log_date;
  const freezeAvailable = isFreezeAvailable(streak, isoWeekKey(new Date()));

  const summary = t('ariaSummary', {
    days: streak.current_streak,
    weeks: streak.weekly_streak,
    longest: streak.longest_streak,
  });

  return (
    <Tooltip
      hasArrow
      label={
        freezeJustUsed
          ? t('freezeUsed')
          : freezeAvailable
            ? t('freezeAvailable')
            : t('freezeSpent')
      }
    >
      <Box
        as="section"
        aria-label={summary}
        display="inline-flex"
        alignItems="center"
        px={3}
        py={1.5}
        bg="orange.50"
        borderWidth="1px"
        borderColor="orange.200"
        borderRadius="full"
        minH="36px"
      >
        <HStack spacing={2}>
          <Text aria-hidden="true" fontSize="md" lineHeight="1">
            🔥
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color="orange.800" whiteSpace="nowrap">
            {t('dayStreak', { days: streak.current_streak })}
          </Text>
          {streak.weekly_streak > 1 && (
            <Text fontSize="xs" color="orange.700" whiteSpace="nowrap">
              {t('weekStreak', { weeks: streak.weekly_streak })}
            </Text>
          )}
          {freezeJustUsed && (
            <Text fontSize="xs" color="blue.700" whiteSpace="nowrap">
              ❄️ {t('freezeUsedShort')}
            </Text>
          )}
          <VisuallyHidden>{summary}</VisuallyHidden>
        </HStack>
      </Box>
    </Tooltip>
  );
}
