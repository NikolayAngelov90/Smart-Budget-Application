'use client';

/**
 * BudgetForecast Component
 * Story 12.2: End-of-Month Budget Projections
 *
 * Displays projected end-of-month spending per category based on the current
 * daily spending rate. Categories projected to exceed their 3-month historical
 * average are flagged as "at risk" with a text badge (not color alone).
 *
 * Progressive disclosure: renders null when user has no current-month data.
 */

import {
  Badge,
  Box,
  Flex,
  Heading,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useBudgetForecast } from '@/lib/hooks/useBudgetForecast';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';
import type { CategoryForecast } from '@/types/database.types';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ForecastRowProps {
  forecast: CategoryForecast;
  currency: string;
}

function ForecastRow({ forecast, currency }: ForecastRowProps) {
  const t = useTranslations('budgetForecast');
  const {
    category_name,
    category_color,
    spent_so_far,
    projected_eom,
    is_at_risk,
    budget_amount,
    budget_source,
  } = forecast;

  // ADR-025 honesty: name the comparison target when it's a user-set budget.
  // Average-baseline rows keep today's exact copy (zero-config must stay unchanged),
  // so the sub-line renders ONLY for explicit budgets.
  const hasBaseline = budget_amount > 0;
  const showBudgetLine = budget_source === 'explicit' && hasBaseline;

  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      align={{ base: 'stretch', md: 'center' }}
      justify="space-between"
      px={4}
      py={3}
      borderBottom="1px solid"
      borderColor="gray.100"
      gap={2}
    >
      {/* Left: color swatch + name + risk badge (own full-width line on mobile) */}
      <Flex align="center" gap={2} flex={{ md: 1 }} minW={0}>
        <Box
          w={3}
          h={3}
          borderRadius="full"
          bg={category_color}
          flexShrink={0}
          aria-hidden="true"
        />
        <Text fontWeight="medium" noOfLines={1}>
          {category_name}
        </Text>
        {is_at_risk ? (
          <Badge colorScheme="orange" flexShrink={0}>
            {t('atRisk')}
          </Badge>
        ) : hasBaseline ? (
          <Badge colorScheme="green" flexShrink={0}>
            {t('onTrack')}
          </Badge>
        ) : null}
      </Flex>

      {/* Right: spent so far + projected EOM (spread on mobile) */}
      <Flex
        align="center"
        gap={4}
        flexShrink={0}
        w={{ base: 'full', md: 'auto' }}
        justify={{ base: 'space-between', md: 'flex-end' }}
      >
        <Box textAlign="right">
          <Text fontSize="xs" color="gray.500">
            {t('spentSoFar')}
          </Text>
          <Text fontWeight="medium">
            {formatAmount(spent_so_far, currency)}
          </Text>
        </Box>
        <Box textAlign="right" minW="90px">
          <Text fontSize="xs" color="gray.500">
            {t('projectedEOM')}
          </Text>
          <Text
            fontWeight="semibold"
            color={is_at_risk ? 'orange.600' : 'gray.700'}
            aria-label={`${t('projectedEOM')}: ${formatAmount(projected_eom, currency)}`}
          >
            {formatAmount(projected_eom, currency)}
          </Text>
          {showBudgetLine && (
            <Text fontSize="xs" color="blue.600">
              {t('vsYourBudget', { amount: formatAmount(budget_amount, currency) })}
            </Text>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BudgetForecast() {
  const t = useTranslations('budgetForecast');
  const { forecasts, hasCurrentMonthData, isLoading } = useBudgetForecast();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  // Progressive disclosure: hide entirely until there is current-month data
  if (!hasCurrentMonthData && !isLoading) return null;

  if (isLoading) {
    return <Skeleton height="200px" borderRadius="md" data-testid="budget-forecast-skeleton" />;
  }

  // Derive day info from first forecast entry (all entries share the same values)
  const firstForecast = forecasts[0];
  const daysElapsed = firstForecast?.days_elapsed ?? 0;
  const daysInMonth = firstForecast?.days_in_month ?? 0;
  const daysRemaining = daysInMonth - daysElapsed;

  return (
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        <VStack align="start" spacing={0}>
          <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
            {t('title')}
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {t('subtitle', { day: daysElapsed, daysInMonth, daysRemaining })}
          </Text>
        </VStack>

        <Box borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden">
          {forecasts.map((f) => (
            <ForecastRow key={f.category_id} forecast={f} currency={currency} />
          ))}
        </Box>
      </VStack>
    </Box>
  );
}
