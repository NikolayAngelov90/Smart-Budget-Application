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

import { Box, HStack, Text, Tooltip } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useStreak } from '@/lib/hooks/useStreak';
import {
  isFreezeAvailable,
  isStreakBroken,
  isoWeekKey,
  localDayKey,
  wasJustFrozen,
} from '@/lib/ai/streakEngine';

export function StreakBadge() {
  const t = useTranslations('streaks');
  const { data } = useStreak();

  // Progressive disclosure: nothing until the first log creates streak state.
  // Errors stay quiet — keepPreviousData holds the last known streak.
  const streak = data?.streak;
  if (!streak || streak.current_streak <= 0) return null;

  // A streak whose gap can no longer be bridged is DEAD — showing a weeks-old
  // count as alive (with a "freeze ready" tooltip) would be a lie (15-1 review).
  // Hiding it is the no-guilt behavior; comeback flows are Story 15.4's job.
  const now = new Date();
  if (isStreakBroken(streak, localDayKey(now))) return null;

  // The engine stamps freeze_used_on with the MISSED day it bridged; the
  // bridging log lands exactly one day later (engine helper encodes this).
  const freezeJustUsed = wasJustFrozen(streak);
  const freezeAvailable = isFreezeAvailable(streak, isoWeekKey(now));

  const freezeStatus = freezeJustUsed
    ? t('freezeUsed')
    : freezeAvailable
      ? t('freezeAvailable')
      : t('freezeSpent');

  // One combined accessible summary: streak + longest + freeze status —
  // everything the tooltip shows, available without hover (15-8 groundwork)
  const summary = `${t('ariaSummary', {
    days: streak.current_streak,
    weeks: streak.weekly_streak,
    longest: streak.longest_streak,
  })}. ${freezeStatus}`;

  return (
    <Tooltip hasArrow label={`${t('longestLabel', { longest: streak.longest_streak })} · ${freezeStatus}`}>
      {/* Focusable so keyboard/touch users can open the tooltip; the aria-label
          carries the same information for screen readers */}
      <Box
        as="section"
        tabIndex={0}
        aria-label={summary}
        display="inline-flex"
        alignItems="center"
        px={3}
        py={1.5}
        bg="orange.50"
        borderWidth="1px"
        borderColor="orange.200"
        borderRadius="full"
        minH={{ base: '44px', md: '36px' }}
        _focusVisible={{ boxShadow: 'outline' }}
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
        </HStack>
      </Box>
    </Tooltip>
  );
}
