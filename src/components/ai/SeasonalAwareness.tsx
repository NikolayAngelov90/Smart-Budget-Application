'use client';

/**
 * SeasonalAwareness Component
 * Story 12.5 / FR6: Seasonal & Cyclical Spending Awareness
 *
 * Shows a 6-month outlook predicting upcoming spend from the same month-of-year
 * in history, flagging seasonal highs. Progressive disclosure: renders nothing
 * until the user has >= 6 months of history.
 */

import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useSeasonalAwareness } from '@/lib/hooks/useSeasonalAwareness';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';
import type { SeasonalMonth } from '@/types/database.types';

function MonthRow({ month, currency }: { month: SeasonalMonth; currency: string }) {
  const t = useTranslations('seasonal');
  // Build a Date from 'YYYY-MM' for localized month label
  const label = format(parseISO(`${month.month}-01`), 'MMM yyyy');
  const hasHistory = month.historical_basis !== null;

  return (
    <Flex
      align="center"
      justify="space-between"
      px={4}
      py={3}
      borderBottom="1px solid"
      borderColor="gray.100"
      gap={2}
      flexWrap="wrap"
    >
      <HStack flex="1" minW={0}>
        <Text fontWeight="medium" noOfLines={1}>
          {label}
        </Text>
        {month.is_seasonal_high && (
          <Badge colorScheme="orange" flexShrink={0}>
            {t('seasonalHigh')}
          </Badge>
        )}
      </HStack>
      {hasHistory ? (
        <Box textAlign="right">
          <Text fontSize="xs" color="gray.500">
            {t('predicted')}
          </Text>
          <Text
            fontWeight="semibold"
            color={month.is_seasonal_high ? 'orange.600' : 'gray.700'}
            aria-label={`${label} ${t('predicted')}: ${formatAmount(month.predicted_amount, currency)}`}
          >
            {formatAmount(month.predicted_amount, currency)}
          </Text>
        </Box>
      ) : (
        <Text fontSize="xs" color="gray.400" fontStyle="italic">
          {t('noHistory')}
        </Text>
      )}
    </Flex>
  );
}

export function SeasonalAwareness() {
  const t = useTranslations('seasonal');
  const { timeline, monthsAnalyzed, hasEnoughData, isLoading } = useSeasonalAwareness();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  // Progressive disclosure: need >= 6 months of history
  if (!hasEnoughData && !isLoading) return null;

  if (isLoading) {
    return <Skeleton height="220px" borderRadius="md" data-testid="seasonal-skeleton" />;
  }

  return (
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        <VStack align="start" spacing={0}>
          <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
            {t('title')}
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {t('subtitle', { months: monthsAnalyzed })}
          </Text>
        </VStack>

        <Box borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden">
          {timeline.map((m) => (
            <MonthRow key={m.month} month={m} currency={currency} />
          ))}
        </Box>

        <FinancialDisclaimer />
      </VStack>
    </Box>
  );
}
