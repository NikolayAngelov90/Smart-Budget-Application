'use client';

/**
 * AnnualizedProjections Component
 * Story 11.4: Annualized Spending Projections
 *
 * Displays annualized spending projections per expense category.
 * Uses progressive disclosure — renders null until user has ≥1 complete
 * past calendar month of expense data.
 *
 * Placement: Dashboard page, below Spending Heatmap (Story 11.3).
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
import { useAnnualizedProjections } from '@/lib/hooks/useAnnualizedProjections';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import type { CategoryProjection } from '@/types/database.types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formats a numeric amount using the user's currency (Intl.NumberFormat).
 * Empty-currency guard: falls back to fixed 2dp if currency is falsy.
 */
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
// SUB-COMPONENTS
// ============================================================================

interface TrendBadgeProps {
  trend: CategoryProjection['trend'];
  trend_percentage: number | null;
}

function TrendBadge({ trend, trend_percentage }: TrendBadgeProps) {
  const t = useTranslations('projections');

  // No badge when there is no prior period to compare against (AC #4: trend only shown with 4+ months)
  if (trend === 'new') {
    return null;
  }
  if (trend === 'stable') {
    return <Badge colorScheme="gray">{t('trendStable')}</Badge>;
  }
  if (trend === 'up') {
    const pct = trend_percentage !== null ? Math.abs(trend_percentage) : 0;
    return (
      <Badge colorScheme="red">
        {t('trendUp', { percentage: pct })}
      </Badge>
    );
  }
  // down
  const pct = trend_percentage !== null ? Math.abs(trend_percentage) : 0;
  return (
    <Badge colorScheme="green">
      {t('trendDown', { percentage: pct })}
    </Badge>
  );
}

interface ProjectionRowProps {
  projection: CategoryProjection;
  currency: string;
}

function ProjectionRow({ projection, currency }: ProjectionRowProps) {
  const t = useTranslations('projections');
  const {
    category_name,
    category_color,
    monthly_avg,
    annual_projection,
    transaction_count,
    is_recurring,
    trend,
    trend_percentage,
  } = projection;

  return (
    <Flex
      align="center"
      justify="space-between"
      px={4}
      py={3}
      borderBottom="1px solid"
      borderColor="gray.100"
      flexWrap="wrap"
      gap={2}
    >
      {/* Left: color swatch + name + badges */}
      <Flex align="center" gap={2} flex="1" minW={0}>
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
        {is_recurring && (
          <Badge colorScheme="purple" flexShrink={0}>
            {t('recurring')}
          </Badge>
        )}
        <TrendBadge trend={trend} trend_percentage={trend_percentage} />
      </Flex>

      {/* Right: transaction count + monthly avg + annual projection */}
      <Flex align="center" gap={4} flexShrink={0}>
        <Box textAlign="right">
          <Text fontSize="xs" color="gray.500">
            {t('transactions')}
          </Text>
          <Text fontWeight="medium">
            {transaction_count}
          </Text>
        </Box>
        <Box textAlign="right">
          <Text fontSize="xs" color="gray.500">
            {t('monthlyAvg')}
          </Text>
          <Text fontWeight="medium" aria-label={`${t('monthlyAvg')}: ${formatAmount(monthly_avg, currency)}`}>
            {formatAmount(monthly_avg, currency)}
          </Text>
        </Box>
        <Box textAlign="right" minW="80px">
          <Text fontSize="xs" color="gray.500">
            {t('annualProjection')}
          </Text>
          <Text fontWeight="semibold" aria-label={`${t('annualProjection')}: ${formatAmount(annual_projection, currency)}`}>
            {formatAmount(annual_projection, currency)}
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
}

interface TotalRowProps {
  total: number;
  currency: string;
}

function TotalRow({ total, currency }: TotalRowProps) {
  const t = useTranslations('projections');
  return (
    <Flex
      align="center"
      justify="space-between"
      px={4}
      py={3}
      bg="gray.50"
      flexWrap="wrap"
      gap={2}
    >
      <Text fontWeight="bold">{t('totalLabel')}</Text>
      <Text fontWeight="bold" aria-label={`${t('totalLabel')}: ${formatAmount(total, currency)}`}>
        {formatAmount(total, currency)}
      </Text>
    </Flex>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AnnualizedProjections() {
  const t = useTranslations('projections');
  const { projections, hasEnoughData, months_analyzed, isLoading } =
    useAnnualizedProjections();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  // Progressive disclosure: hide entirely until user has enough data
  if (!hasEnoughData && !isLoading) return null;

  if (isLoading) {
    return <Skeleton height="200px" borderRadius="md" data-testid="projections-skeleton" />;
  }

  const totalAnnual =
    Math.round(projections.reduce((sum, p) => sum + p.annual_projection, 0) * 100) / 100;

  return (
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        <VStack align="start" spacing={0}>
          <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
            {t('title')}
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {t('subtitle', { count: months_analyzed })}
          </Text>
        </VStack>

        <Box borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden">
          {projections.map((p) => (
            <ProjectionRow key={p.category_id} projection={p} currency={currency} />
          ))}
          <TotalRow total={totalAnnual} currency={currency} />
        </Box>
      </VStack>
    </Box>
  );
}
