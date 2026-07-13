'use client';

/**
 * BudgetScoreRing Component — Story 15.2 (FR29)
 *
 * Circular Budget Score (0-100) visualization with level tier and a tap/click
 * breakdown of the three factors (helping / hurting / neutral / unscored).
 * Single mount point by design: Story 15.6's gamification opt-out will gate
 * exactly this component (StreakBadge precedent).
 *
 * Progressive disclosure: renders null until the score exists (hasData) —
 * no skeleton flash (BudgetHealthCard precedent). Ring color steps by level,
 * approximating the UX green→blue gradient without SVG gradient hacks.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  CircularProgress,
  CircularProgressLabel,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Tag,
  Text,
  VStack,
  usePrefersReducedMotion,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useTranslations } from 'next-intl';
import { useBudgetScore } from '@/lib/hooks/useBudgetScore';
import { useAchievementToast } from '@/lib/hooks/useAchievementToast';
import type { BudgetScoreLevel, ScoreFactor } from '@/types/database.types';

const LEVEL_COLOR: Record<BudgetScoreLevel, string> = {
  beginner: 'green.400',
  building: 'green.500',
  steady: 'teal.500',
  strong: 'blue.500',
  master: 'blue.600',
};

const LEVEL_BADGE: Record<BudgetScoreLevel, string> = {
  beginner: 'green',
  building: 'green',
  steady: 'teal',
  strong: 'blue',
  master: 'blue',
};

const STATUS_TAG: Record<ScoreFactor['status'], { colorScheme: string; variant: string }> = {
  helping: { colorScheme: 'green', variant: 'subtle' },
  hurting: { colorScheme: 'red', variant: 'subtle' },
  neutral: { colorScheme: 'gray', variant: 'subtle' },
  unscored: { colorScheme: 'gray', variant: 'outline' },
};

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
`;

const LEVEL_ORDER: BudgetScoreLevel[] = ['beginner', 'building', 'steady', 'strong', 'master'];

export function BudgetScoreRing() {
  const t = useTranslations('score');
  const { data } = useBudgetScore();
  const prefersReducedMotion = usePrefersReducedMotion();
  const toastAchievements = useAchievementToast();

  // Story 15.3: score-side unlocks (budgets/goals/score achievements) arrive
  // in the score payload — toast each batch once (SWR may hand back the same
  // cached object across renders; the ref guards against re-toasting it)
  const toastedRef = useRef<unknown>(null);
  const newlyUnlocked = data?.newlyUnlocked;
  useEffect(() => {
    if (!newlyUnlocked || newlyUnlocked.length === 0) return;
    if (toastedRef.current === newlyUnlocked) return;
    toastedRef.current = newlyUnlocked;
    toastAchievements(newlyUnlocked);
  }, [newlyUnlocked, toastAchievements]);

  // Level-up pulse: animate only when the level rises within this session
  const prevLevelRef = useRef<BudgetScoreLevel | null>(null);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const level = data?.budgetScore?.level;
  useEffect(() => {
    if (!level) return;
    const prev = prevLevelRef.current;
    prevLevelRef.current = level;
    if (prev && LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(prev)) {
      setJustLeveledUp(true);
      const timer = setTimeout(() => setJustLeveledUp(false), 1200);
      return () => clearTimeout(timer);
    }
    // Down/flat transition: reset explicitly — if a level DROP lands within
    // the pulse window, the cleanup above cancels the timer and justLeveledUp
    // would stick true forever, swallowing every future level-up pulse.
    setJustLeveledUp(false);
  }, [level]);

  // Progressive disclosure: nothing until the user has scoreable data.
  // keepPreviousData holds the last known score through transient errors.
  const budgetScore = data?.budgetScore;
  if (!data || data.hasData === false || !budgetScore) return null;

  const ariaLabel = t('ariaLabel', {
    score: budgetScore.score,
    level: t(`levels.${budgetScore.level}`),
  });

  return (
    // Carries its own bottom margin so no-data users get no phantom gap
    <Box as="section" mb={{ base: 6, md: 8 }}>
      <Popover placement="bottom-start">
      <PopoverTrigger>
        <Box
          as="button"
          type="button"
          aria-label={ariaLabel}
          borderRadius="full"
          _focusVisible={{ boxShadow: 'outline' }}
          animation={
            justLeveledUp && !prefersReducedMotion ? `${pulse} 0.6s ease-in-out 2` : undefined
          }
        >
          <VStack spacing={1}>
            <CircularProgress
              value={budgetScore.score}
              size="120px"
              thickness="8px"
              color={LEVEL_COLOR[budgetScore.level]}
              trackColor="gray.100"
              capIsRound
            >
              <CircularProgressLabel
                fontSize="2rem"
                fontWeight={700}
                fontFamily="mono"
                color="gray.800"
              >
                {budgetScore.score}
              </CircularProgressLabel>
            </CircularProgress>
            <Badge colorScheme={LEVEL_BADGE[budgetScore.level]} borderRadius="full" px={2}>
              {t(`levels.${budgetScore.level}`)}
            </Badge>
          </VStack>
        </Box>
      </PopoverTrigger>
      {/* Screen readers hear score changes without opening the breakdown */}
      <Box aria-live="polite" position="absolute" w="1px" h="1px" overflow="hidden" clipPath="inset(50%)">
        {ariaLabel}
      </Box>
      <PopoverContent w="18rem">
        <PopoverArrow />
        <PopoverHeader fontWeight={600}>{t('breakdownTitle')}</PopoverHeader>
        <PopoverBody>
          <VStack align="stretch" spacing={3}>
            {budgetScore.factors.map((factor) => (
              <Box key={factor.key}>
                <HStack justify="space-between">
                  <Text fontSize="sm" fontWeight={500}>
                    {t(`factors.${factor.key}`)}
                  </Text>
                  <HStack spacing={2}>
                    {factor.status !== 'unscored' && (
                      <Text fontSize="sm" color="gray.600" fontFamily="mono">
                        {factor.earned}/{factor.max}
                      </Text>
                    )}
                    <Tag size="sm" {...STATUS_TAG[factor.status]}>
                      {t(`status.${factor.status}`)}
                    </Tag>
                  </HStack>
                </HStack>
                {factor.status === 'unscored' && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {t(`hint.${factor.key}`)}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  );
}
