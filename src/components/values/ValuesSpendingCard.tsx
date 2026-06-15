'use client';

/**
 * ValuesSpendingCard — Story 14.2: Values-Context Spending View
 *
 * Dashboard card: the user's current-month spend grouped by their values (priority order),
 * each with share-of-spend, a trend arrow vs last month, and a gentle "over-spending vs
 * priority" nudge when a low-priority value takes a large share. An "Unassigned" row keeps
 * the picture honest. Progressive disclosure: renders nothing when there's no values plan.
 */

import { Box, Card, CardBody, VStack, HStack, Heading, Text, Progress, Badge } from '@chakra-ui/react';
import { TriangleUpIcon, TriangleDownIcon, MinusIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { useValuesSpending } from '@/lib/hooks/useValuesSpending';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';
import type { ValueSpendRow } from '@/types/database.types';

function TrendIndicator({ row }: { row: ValueSpendRow }) {
  const t = useTranslations('values');
  if (row.trendDirection === 'up') {
    return (
      <HStack spacing={1} color="red.500">
        <TriangleUpIcon boxSize={2.5} />
        <Text fontSize="xs">{t('trendUp', { pct: row.trendPct })}</Text>
      </HStack>
    );
  }
  if (row.trendDirection === 'down') {
    return (
      <HStack spacing={1} color="green.500">
        <TriangleDownIcon boxSize={2.5} />
        <Text fontSize="xs">{t('trendDown', { pct: row.trendPct })}</Text>
      </HStack>
    );
  }
  return (
    <HStack spacing={1} color="gray.400">
      <MinusIcon boxSize={2} />
      <Text fontSize="xs">{t('trendFlat')}</Text>
    </HStack>
  );
}

export function ValuesSpendingCard() {
  const t = useTranslations('values');
  const { view, isLoading, error } = useValuesSpending();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format || 'EUR';

  // Progressive disclosure: nothing to show until the user has a values plan.
  if (isLoading || error || !view || !view.hasPlan) return null;

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={4}>
          <Box>
            <Heading as="h2" size="md" color="gray.700">
              {t('spendingHeading')}
            </Heading>
            <Text fontSize="xs" color="gray.500">
              {t('thisMonth')}
            </Text>
          </Box>

          {view.values.map((row) => (
            <VStack key={row.id} align="stretch" spacing={1}>
              <HStack justify="space-between" align="center">
                <HStack spacing={2} minW={0}>
                  <Badge colorScheme="blue" borderRadius="full" px={2} flexShrink={0}>
                    #{row.rank}
                  </Badge>
                  <Text fontSize="sm" color="gray.800" noOfLines={1}>
                    {row.name}
                  </Text>
                  {row.misaligned && (
                    <Badge colorScheme="orange" fontSize="10px" flexShrink={0}>
                      {t('misaligned')}
                    </Badge>
                  )}
                </HStack>
                <HStack spacing={3} flexShrink={0}>
                  <TrendIndicator row={row} />
                  <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                    {formatAmount(row.amount, currency)}
                  </Text>
                </HStack>
              </HStack>
              <HStack spacing={2}>
                <Progress
                  value={row.percentage}
                  size="xs"
                  borderRadius="full"
                  colorScheme={row.misaligned ? 'orange' : 'blue'}
                  flex={1}
                />
                <Text fontSize="xs" color="gray.500" w="36px" textAlign="right">
                  {row.percentage}%
                </Text>
              </HStack>
            </VStack>
          ))}

          {view.unassigned.amount > 0 && (
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color="gray.500">
                  {t('unassigned')}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {formatAmount(view.unassigned.amount, currency)}
                </Text>
              </HStack>
              <HStack spacing={2}>
                <Progress
                  value={view.unassigned.percentage}
                  size="xs"
                  borderRadius="full"
                  colorScheme="gray"
                  flex={1}
                />
                <Text fontSize="xs" color="gray.500" w="36px" textAlign="right">
                  {view.unassigned.percentage}%
                </Text>
              </HStack>
              <Text fontSize="xs" color="gray.400">
                {t('unassignedHelp')}
              </Text>
            </VStack>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
