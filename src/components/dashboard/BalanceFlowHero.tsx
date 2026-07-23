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
import { useTranslations } from 'next-intl';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatCurrency, calculateTrend } from '@/lib/utils/currency';

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
}

function FlowStat({ label, amount, color, align = 'start', emphasis = false }: FlowStatProps) {
  return (
    <VStack spacing={0.5} align={align} minW={0}>
      <HStack spacing={1.5}>
        <Box w="7px" h="7px" borderRadius="full" bg={color} flexShrink={0} />
        <Text fontSize="2xs" fontWeight="semibold" letterSpacing="wide" textTransform="uppercase" color="fg.muted">
          {label}
        </Text>
      </HStack>
      <Text
        className="tnum"
        fontFamily="heading"
        fontSize={emphasis ? { base: 'lg', md: 'xl' } : { base: 'md', md: 'lg' }}
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

export function BalanceFlowHero() {
  const t = useTranslations('dashboard');
  const reduce = useReducedMotion();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format;
  const { data: profile } = useUserProfile(true);
  const { data, error, isLoading, mutate } = useDashboardStats(undefined, currencyCode);

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

  const animate = !reduce && !isLoading && !!data;
  const animatedBalance = useCountUp(balance, animate);

  // Proportional split of the month's flow. Guard the zero-flow case.
  const flowTotal = income + expenses;
  const incomePct = flowTotal > 0 ? (income / flowTotal) * 100 : 0;
  const expensePct = flowTotal > 0 ? (expenses / flowTotal) * 100 : 0;

  const keptShare = income > 0 ? Math.round((remaining / income) * 100) : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greetingMorning');
    if (h < 18) return t('greetingAfternoon');
    return t('greetingEvening');
  })();
  const name = profile?.display_name?.trim();

  const balanceIsPositive = balance >= 0;
  const trendUp = balanceTrend >= 0;

  if (error) {
    return (
      <Box bg="surface" borderRadius="2xl" borderWidth="1px" borderColor="border" p={{ base: 5, md: 7 }}>
        <Text fontWeight="semibold" color="fg">{t('failedToLoad')}</Text>
        <Text fontSize="sm" color="fg.muted" mt={1}>{t('failedToLoadDescription')}</Text>
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
      <Flex justify="space-between" align="baseline" gap={3} flexWrap="wrap" mb={{ base: 5, md: 6 }}>
        <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight={600} color="fg" letterSpacing="tight" fontFamily="heading">
          {name ? `${greeting}, ${name}` : greeting}
        </Text>
        <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
          {format(new Date(), 'EEE, d MMM')}
        </Text>
      </Flex>

      {/* Primary: total balance */}
      <VStack align="start" spacing={1} mb={{ base: 6, md: 7 }}>
        <Text fontSize="2xs" fontWeight="semibold" letterSpacing="wider" textTransform="uppercase" color="fg.muted">
          {t('totalBalance')}
        </Text>
        {isLoading ? (
          <Skeleton height={{ base: '48px', md: '60px' }} width="min(320px, 70%)" borderRadius="lg" />
        ) : (
          <HStack align="baseline" spacing={3} flexWrap="wrap">
            <Text
              className="tnum"
              fontFamily="heading"
              fontSize={{ base: '5xl', md: '6xl' }}
              fontWeight={700}
              letterSpacing="tighter"
              lineHeight={1}
              color={balanceIsPositive ? 'fg' : 'expense'}
            >
              {formatCurrency(animate ? animatedBalance : balance, undefined, currencyCode)}
            </Text>
            {incomePrev - expensesPrev !== 0 && (
              <HStack
                spacing={1}
                px={2.5}
                py={1}
                borderRadius="full"
                bg={trendUp ? 'income.subtle' : 'expense.subtle'}
                color={trendUp ? 'income' : 'expense'}
                flexShrink={0}
              >
                <Text fontSize="sm" fontWeight={700} lineHeight={1}>{trendUp ? '↑' : '↓'}</Text>
                <Text className="tnum" fontSize="sm" fontWeight={600} lineHeight={1}>
                  {Math.abs(balanceTrend).toFixed(1)}%
                </Text>
                <Text fontSize="xs" fontWeight={500} lineHeight={1} display={{ base: 'none', sm: 'block' }}>
                  {t('vsLastMonth')}
                </Text>
              </HStack>
            )}
          </HStack>
        )}
      </VStack>

      {/* Secondary: this month's flow */}
      <Box>
        <Text fontSize="2xs" fontWeight="semibold" letterSpacing="wider" textTransform="uppercase" color="fg.muted" mb={2.5}>
          {t('thisMonth')}
        </Text>

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
                  transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.1, ease: [0.4, 0, 0.2, 1] }}
                />
              </>
            ) : null}
          </Box>
        )}

        {/* In / Out / Left */}
        <Flex justify="space-between" align="flex-start" gap={4}>
          <FlowStat label={t('moneyIn')} amount={formatCurrency(income, undefined, currencyCode)} color="income" />
          <FlowStat label={t('moneyLeft')} amount={formatCurrency(remaining, undefined, currencyCode)} color={remaining >= 0 ? 'income' : 'expense'} align="center" emphasis />
          <FlowStat label={t('moneyOut')} amount={formatCurrency(expenses, undefined, currencyCode)} color="expense" align="end" />
        </Flex>

        {/* Plain-language, non-judgmental caption */}
        {!isLoading && (
          <Text fontSize="sm" color="fg.muted" mt={4} lineHeight={1.5}>
            {flowTotal === 0
              ? t('flowEmpty')
              : keptShare !== null && keptShare >= 0
                ? t('keptShare', { percent: keptShare })
                : t('overspentMonth', { amount: formatCurrency(Math.abs(remaining), undefined, currencyCode) })}
          </Text>
        )}
      </Box>
    </Box>
  );
}
