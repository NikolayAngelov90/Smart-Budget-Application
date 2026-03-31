'use client';

/**
 * WeeklyDigestCard Component
 * Story 11.7: Weekly Financial Digest
 *
 * Displays a weekly spending summary on the dashboard.
 * Progressive disclosure: renders null when no digest exists yet.
 * Shows skeleton while loading.
 */

import {
  Badge,
  Box,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  HStack,
  Heading,
  Progress,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ArrowDownIcon, ArrowUpIcon } from '@chakra-ui/icons';
import { format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useWeeklyDigest } from '@/lib/hooks/useWeeklyDigest';
import type { DigestTopCategory } from '@/types/database.types';

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
// COMPONENT
// ============================================================================

export function WeeklyDigestCard() {
  const t = useTranslations('digest');
  const { digest, isLoading, error } = useWeeklyDigest();

  // Progressive disclosure: render nothing when no digest exists yet,
  // or when the fetch failed and there is no stale cached data.
  // SWR preserves the previous value on revalidation errors, so stale data
  // will still render — the null return only fires when there is truly nothing to show.
  if (!isLoading && digest === null && !error) {
    return null;
  }

  // On error with no cached data, render nothing (progressive disclosure —
  // the digest card is informational, not critical UI).
  if (error && digest === null) {
    return null;
  }

  // Skeleton while loading
  if (isLoading) {
    return (
      <Card data-testid="weekly-digest-card" aria-label={t('loading')}>
        <CardHeader pb={2}>
          <Skeleton height="20px" width="200px" />
        </CardHeader>
        <CardBody pt={0}>
          <VStack align="stretch" spacing={3}>
            <Skeleton height="16px" />
            <Skeleton height="16px" width="60%" />
            <Skeleton height="16px" />
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (!digest) return null;

  const weekStartFormatted = format(parseISO(digest.week_start), 'MMM d');
  const weekEndFormatted = format(parseISO(digest.week_end), 'MMM d');
  const pct = digest.spending_change_pct;
  const isIncrease = pct > 0;
  const isDecrease = pct < 0;
  const changeColor = isDecrease ? 'green.500' : isIncrease ? 'red.500' : 'gray.500';
  const changeLabel = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;

  const totalForBar = digest.top_categories.reduce((sum: number, c: DigestTopCategory) => sum + c.total, 0);

  return (
    <Card
      data-testid="weekly-digest-card"
      aria-label={`${t('title')}: ${t('weekOf', { start: weekStartFormatted, end: weekEndFormatted })}`}
    >
      <CardHeader pb={2}>
        <Flex justify="space-between" align="center">
          <Heading size="sm">{t('title')}</Heading>
          <Text fontSize="xs" color="gray.500">
            {t('weekOf', { start: weekStartFormatted, end: weekEndFormatted })}
          </Text>
        </Flex>
      </CardHeader>

      <CardBody pt={0}>
        <VStack align="stretch" spacing={4}>
          {/* Total Spending + Change */}
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>
              {t('totalSpending')}
            </Text>
            <Flex align="center" gap={3}>
              <Text fontSize="xl" fontWeight="bold">
                {formatAmount(digest.total_spending, digest.currency)}
              </Text>
              <HStack spacing={1} color={changeColor}>
                {isIncrease && <ArrowUpIcon data-testid="change-increase-icon" aria-hidden="true" />}
                {isDecrease && <ArrowDownIcon data-testid="change-decrease-icon" aria-hidden="true" />}
                <Text fontSize="sm" fontWeight="semibold">
                  {t('vsLastWeek', { pct: changeLabel })}
                </Text>
              </HStack>
            </Flex>
          </Box>

          {digest.top_categories.length > 0 && (
            <>
              <Divider />

              {/* Top Categories */}
              <Box>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  {t('topCategories')}
                </Text>
                <VStack align="stretch" spacing={2} role="list">
                  {digest.top_categories.map((cat: DigestTopCategory) => {
                    const barPct = totalForBar > 0 ? (cat.total / totalForBar) * 100 : 0;
                    return (
                      <Box key={cat.category_id} role="listitem">
                        <Flex justify="space-between" mb={1}>
                          <HStack spacing={2}>
                            <Badge
                              bg={cat.color}
                              w="10px"
                              h="10px"
                              borderRadius="full"
                              p={0}
                              aria-hidden="true"
                            />
                            <Text fontSize="sm">{cat.name}</Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600">
                            {formatAmount(cat.total, digest.currency)}
                          </Text>
                        </Flex>
                        <Progress
                          value={barPct}
                          size="xs"
                          colorScheme="blue"
                          aria-label={`${cat.name}: ${barPct.toFixed(0)}%`}
                        />
                      </Box>
                    );
                  })}
                </VStack>
              </Box>
            </>
          )}

          {digest.actionable_highlight && (
            <>
              <Divider />
              <Box>
                <Text fontSize="xs" color="gray.500" mb={1}>
                  {t('highlight')}
                </Text>
                <Text fontSize="sm">{digest.actionable_highlight}</Text>
              </Box>
            </>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
