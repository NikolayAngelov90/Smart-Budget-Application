'use client';

/**
 * BalanceFlowHero — the dashboard's signature.
 *
 * One dominant moment that answers the whole brief at a glance: how much you
 * have (the big balance), and how this month is flowing (the in -> out FLOW
 * BAR). Replaces the old undifferentiated 4-up StatCard grid.
 *
 * The flow bar is a single track split into "money in" (evergreen) and
 * "money out" (clay) — expenses are never alarm-red here; they're just where
 * the money went. The caption states, in plain encouraging language, how much
 * of what came in was kept.
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Flex, HStack, Skeleton, Text, VStack } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import type { DashboardPeriod } from '@/lib/utils/dashboardPeriod';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatCurrency, calculateTrend } from '@/lib/utils/currency';
import { getDateLocale } from '@/lib/utils/dateFormatter';

const MotionBox = motion(Box);

/** Count a formatted number up from 0 on mount (skipped for reduced motion). */
function useCountUp(target: number, enabled: boolean, durationMs = 750): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled, durationMs]);

  return value;
}

interface FlowStatProps {
  label: string;
  amount: string;
  color: string;
  align?: 'start' | 'end' | 'center';
  emphasis?: boolean;
  /** Three seven-figure sums side by side outgrow a 390px row. */
  compact?: boolean;
}

function FlowStat({
  label,
  amount,
  color,
  align = 'start',
  emphasis = false,
  compact = false,
}: FlowStatProps) {
  return (
    <VStack spacing={0.5} align={align} minW={0}>
      <HStack spacing={1.5}>
        <Box w="7px" h="7px" borderRadius="full" bg={color} flexShrink={0} />
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          letterSpacing="wide"
          textTransform="uppercase"
          color="fg.muted"
        >
          {label}
        </Text>
      </HStack>
      <Text
        className="tnum"
        fontFamily="heading"
        fontSize={
          compact
            ? emphasis
              ? { base: 'sm', md: 'lg' }
              : { base: 'xs', md: 'md' }
            : emphasis
              ? { base: 'lg', md: 'xl' }
              : { base: 'md', md: 'lg' }
        }
        fontWeight={emphasis ? 700 : 600}
        color={emphasis ? 'fg' : color}
        letterSpacing="tight"
        lineHeight={1.1}
      >
        {amount}
      </Text>
    </VStack>
  );
}

/**
 * Story 16.6: every string that used to be month-worded, keyed by period.
 * A lookup rather than string-building because Bulgarian inflects these
 * differently and interpolating a period name produces broken grammar.
 */
const COPY: Record<
  DashboardPeriod,
  { net: string; vsPrevious: string; kept: string; overspent: string; empty: string }
> = {
  week: {
    net: 'netThisWeek',
    vsPrevious: 'vsLastWeek',
    kept: 'keptShareWeek',
    overspent: 'overspentWeek',
    empty: 'flowEmptyWeek',
  },
  month: {
    net: 'netThisMonth',
    vsPrevious: 'vsLastMonth',
    kept: 'keptShare',
    overspent: 'overspentMonth',
    empty: 'flowEmpty',
  },
  quarter: {
    net: 'netThisQuarter',
    vsPrevious: 'vsPrevQuarter',
    kept: 'keptShareQuarter',
    overspent: 'overspentQuarter',
    empty: 'flowEmptyQuarter',
  },
  year: {
    net: 'netThisYear',
    vsPrevious: 'vsLastYear',
    kept: 'keptShareYear',
    overspent: 'overspentYear',
    empty: 'flowEmptyYear',
  },
};

export function BalanceFlowHero() {
  const t = useTranslations('dashboard');
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const reduce = useReducedMotion();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format;
  const { data: profile } = useUserProfile(true);
  const { data, error, isLoading, mutate } = useDashboardStats(undefined, currencyCode, period);

  // Label from the DATA's period, not the selection. `keepPreviousData` holds
  // the outgoing period's figures on screen while the new ones load, and
  // `isLoading` stays false throughout because data is present — so labelling
  // by selection would print "This year" over last month's money. The server
  // echoes back which window it actually aggregated; trust that.
  const shownPeriod = data?.period ?? period;
  const copy = COPY[shownPeriod];
  const isSwitching = !!data && data.period !== period;

  // Keep the hero live as transactions change (this replaces DashboardStats'
  // realtime subscription now that the hero is the primary overview).
  useRealtimeSubscription(() => mutate());

  const balance = data?.balance ?? 0;
  const income = data?.income.current ?? 0;
  const expenses = data?.expenses.current ?? 0;
  const remaining = income - expenses;
  const incomePrev = data?.income.previous ?? 0;
  const expensesPrev = data?.expenses.previous ?? 0;
  const balanceTrend = calculateTrend(balance, incomePrev - expensesPrev);
  // Show the comparison whenever the previous window had ANY activity. Gating
  // on its NET being non-zero hid the chip for a week that earned and spent
  // €1,000 each — real activity that happened to cancel out. Exact-zero nets
  // are far likelier over a week than over a month.
  const hasPrevious = incomePrev + expensesPrev > 0;

  // Count up on the FIRST load only. Re-running it per selection turned every
  // tap into a 750ms roll-up from zero, delaying the figure the tap asked for.
  const hasAnimated = useRef(false);
  const animate = !reduce && !isLoading && !!data && !hasAnimated.current;
  useEffect(() => {
    if (!isLoading && data) hasAnimated.current = true;
  }, [isLoading, data]);
  const animatedBalance = useCountUp(balance, animate);

  // Proportional split of the month's flow. Guard the zero-flow case.
  const flowTotal = income + expenses;
  const incomePct = flowTotal > 0 ? (income / flowTotal) * 100 : 0;
  const expensePct = flowTotal > 0 ? (expenses / flowTotal) * 100 : 0;

  // `remaining >= 0`, not `keptShare >= 0`: Math.round(-0.4) is -0, and -0 >= 0
  // is true, so a €0.40 overspend rendered "You kept -0% of what came in".
  const keptShare = income > 0 ? Math.round((remaining / income) * 100) : null;
  const kept = remaining >= 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greetingMorning');
    if (h < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  })();
  const name = profile?.display_name?.trim();

  const balanceIsPositive = balance >= 0;

  // Step the signature figure down for long strings. At 390px the container is
  // ~264px and the 48px face needs ~267px from EUR 123,456.78 upward — and the
  // hero clips (overflow: hidden), so it would silently cut digits off. Year
  // makes six-figure sums ordinary. Sized from the settled value, not the
  // animated one, so the type doesn't resize mid count-up.
  const formattedBalance = formatCurrency(balance, undefined, currencyCode);
  const formattedIn = formatCurrency(income, undefined, currencyCode);
  const formattedOut = formatCurrency(expenses, undefined, currencyCode);
  const formattedLeft = formatCurrency(remaining, undefined, currencyCode);
  const flowCompact = Math.max(formattedIn.length, formattedOut.length, formattedLeft.length) > 12;

  const balanceFontSize =
    formattedBalance.length > 12
      ? { base: '3xl', md: '5xl' }
      : formattedBalance.length > 10
        ? { base: '4xl', md: '6xl' }
        : { base: '5xl', md: '6xl' };
  const trendUp = balanceTrend >= 0;

  if (error) {
    return (
      <Box
        bg="surface"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border"
        p={{ base: 5, md: 7 }}
      >
        {/* The selector stays mounted: one period failing (a year scan is the
            most likely) must not strand the user in an error card with no way
            back to a period that works. */}
        <Box mb={{ base: 5, md: 6 }}>
          <PeriodSelector value={period} onChange={setPeriod} />
        </Box>
        <Text fontWeight="semibold" color="fg">
          {t('failedToLoad')}
        </Text>
        <Text fontSize="sm" color="fg.muted" mt={1}>
          {t('failedToLoadDescription')}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      bg="surface"
      borderRadius="2xl"
      boxShadow="md"
      borderWidth="1px"
      borderColor="border"
      p={{ base: 5, md: 7 }}
      overflow="hidden"
      position="relative"
    >
      {/* Greeting eyebrow */}
      <Flex
        justify="space-between"
        align="baseline"
        gap={3}
        flexWrap="wrap"
        mb={{ base: 5, md: 6 }}
      >
        <Text
          fontSize={{ base: 'md', md: 'lg' }}
          fontWeight={600}
          color="fg"
          letterSpacing="tight"
          fontFamily="heading"
        >
          {name ? `${greeting}, ${name}` : greeting}
        </Text>
        <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
          {format(new Date(), 'EEE, d MMM', dateLocale ? { locale: dateLocale } : undefined)}
        </Text>
      </Flex>

      {/* Story 16.6: the period this whole hero describes. Above the figure,
          because it changes what the figure MEANS — a control placed below
          would read as filtering something already stated. */}
      <Box mb={{ base: 5, md: 6 }}>
        <PeriodSelector value={period} onChange={setPeriod} />
      </Box>

      <Box
        opacity={isSwitching ? 0.55 : 1}
        transition="opacity 0.15s ease"
        aria-busy={isSwitching || undefined}
      >
        {/* Primary: net for the selected period */}
        <VStack align="start" spacing={1} mb={{ base: 6, md: 7 }}>
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            letterSpacing="wider"
            textTransform="uppercase"
            color="fg.muted"
          >
            {t(copy.net)}
          </Text>
          {isLoading ? (
            <Skeleton
              height={{ base: '48px', md: '60px' }}
              width="min(320px, 70%)"
              borderRadius="lg"
            />
          ) : (
            <HStack align="baseline" spacing={3} flexWrap="wrap">
              <Text
                className="tnum"
                fontFamily="heading"
                fontSize={balanceFontSize}
                fontWeight={700}
                letterSpacing="tighter"
                lineHeight={1}
                color={balanceIsPositive ? 'fg' : 'expense'}
              >
                {animate
                  ? formatCurrency(animatedBalance, undefined, currencyCode)
                  : formattedBalance}
              </Text>
              {hasPrevious && (
                <HStack
                  spacing={1}
                  px={2.5}
                  py={1}
                  borderRadius="full"
                  bg={trendUp ? 'income.subtle' : 'expense.subtle'}
                  color={trendUp ? 'income' : 'expense'}
                  flexShrink={0}
                >
                  <Text fontSize="sm" fontWeight={700} lineHeight={1}>
                    {trendUp ? '↑' : '↓'}
                  </Text>
                  <Text className="tnum" fontSize="sm" fontWeight={600} lineHeight={1}>
                    {Math.abs(balanceTrend) > 999 ? '999+' : Math.abs(balanceTrend).toFixed(1)}%
                  </Text>
                  <Text
                    fontSize="xs"
                    fontWeight={500}
                    lineHeight={1}
                    display={{ base: 'none', sm: 'block' }}
                  >
                    {t(copy.vsPrevious)}
                  </Text>
                </HStack>
              )}
            </HStack>
          )}
        </VStack>

        {/* Secondary: the same period's flow. Deliberately unlabelled — the
          eyebrow above already names the period, and repeating it here
          printed the identical words twice in one card. */}
        <Box>
          {isLoading ? (
            <Skeleton height="14px" width="full" borderRadius="full" mb={4} />
          ) : (
            <Box
              role="img"
              aria-label={`${t('moneyIn')} ${formatCurrency(income, undefined, currencyCode)}, ${t('moneyOut')} ${formatCurrency(expenses, undefined, currencyCode)}`}
              h="14px"
              w="full"
              borderRadius="full"
              bg="surface.sunken"
              overflow="hidden"
              display="flex"
              mb={4}
            >
              {flowTotal > 0 ? (
                <>
                  <MotionBox
                    h="full"
                    bg="income"
                    initial={{ width: reduce ? `${incomePct}%` : 0 }}
                    animate={{ width: `${incomePct}%` }}
                    transition={{ duration: reduce ? 0 : 0.7, ease: [0.4, 0, 0.2, 1] }}
                  />
                  <MotionBox
                    h="full"
                    bg="expense"
                    initial={{ width: reduce ? `${expensePct}%` : 0 }}
                    animate={{ width: `${expensePct}%` }}
                    transition={{
                      duration: reduce ? 0 : 0.7,
                      delay: reduce ? 0 : 0.1,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  />
                </>
              ) : null}
            </Box>
          )}

          {/* In / Out / Left */}
          <Flex justify="space-between" align="flex-start" gap={{ base: 2, sm: 4 }}>
            <FlowStat
              label={t('moneyIn')}
              amount={formattedIn}
              color="income"
              compact={flowCompact}
            />
            <FlowStat
              label={t('moneyLeft')}
              amount={formattedLeft}
              color={remaining >= 0 ? 'income' : 'expense'}
              align="center"
              emphasis
              compact={flowCompact}
            />
            <FlowStat
              label={t('moneyOut')}
              amount={formattedOut}
              color="expense"
              align="end"
              compact={flowCompact}
            />
          </Flex>

          {/* Plain-language, non-judgmental caption */}
          {!isLoading && (
            <Text fontSize="sm" color="fg.muted" mt={4} lineHeight={1.5}>
              {flowTotal === 0
                ? t(copy.empty)
                : keptShare !== null && kept
                  ? t(copy.kept, { percent: keptShare })
                  : t(copy.overspent, {
                      amount: formatCurrency(Math.abs(remaining), undefined, currencyCode),
                    })}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
