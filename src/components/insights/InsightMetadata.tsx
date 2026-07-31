'use client';

import {
  VStack,
  Text,
  Box,
  Divider,
  Badge,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import Link from 'next/link';
import { ArrowForwardIcon } from '@chakra-ui/icons';
import type { Insight } from '@/types/database.types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils/currency';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useLocale, useTranslations } from 'next-intl';
import { getDateLocale } from '@/lib/utils/dateFormatter';

interface InsightMetadataProps {
  insight: Insight;
}

// Type-safe metadata interfaces for each insight type
interface SpendingIncreaseMetadata {
  category_id: string;
  category_name: string;
  current_amount: number;
  previous_amount: number;
  percent_change: number;
  transaction_count_current: number;
  transaction_count_previous: number;
  current_month: string;
  previous_month: string;
}

interface BudgetRecommendationMetadata {
  category_id: string;
  category_name: string;
  three_month_average: number;
  recommended_budget: number;
  calculation_explanation: string;
  months_analyzed: string[];
}

interface UnusualExpenseMetadata {
  category_id: string;
  category_name: string;
  transaction_amount: number;
  category_average: number;
  standard_deviation: number;
  std_devs_from_mean: number;
  transaction_id: string;
  transaction_date: string;
}

interface PositiveReinforcementMetadata {
  category_id: string;
  category_name: string;
  budget_amount: number;
  actual_spending: number;
  savings_amount: number;
  percent_under_budget: number;
  current_month: string;
}

// Format month helper
const formatMonth = (monthStr: string): string => {
  try {
    const date = new Date(monthStr + '-01');
    return format(date, 'MMMM yyyy');
  } catch {
    return monthStr;
  }
};

// Format percentage helper
const formatPercent = (percent: number): string => {
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
};

// Build transaction link URL with query params
const buildTransactionLink = (categoryId: string, month: string): string => {
  const params = new URLSearchParams({
    category: categoryId,
    month: month,
  });
  return `/transactions?${params.toString()}`;
};

// Metadata field component for consistent styling
interface MetadataFieldProps {
  label: string;
  value: string | number | React.ReactNode;
  highlight?: boolean;
}

function MetadataField({ label, value, highlight = false }: MetadataFieldProps) {
  return (
    <GridItem>
      <VStack align="start" spacing={1}>
        <Text fontSize="xs" color="fg.subtle" fontWeight="medium">
          {label}
        </Text>
        <Text
          fontSize="md"
          fontWeight={highlight ? 'bold' : 'semibold'}
          color={highlight ? 'accent' : 'fg'}
        >
          {value}
        </Text>
      </VStack>
    </GridItem>
  );
}

/**
 * Types with a real metadata renderer.
 *
 * Everything else (the Epic-12 `spending_anomaly` and `new_high_spend_category`)
 * used to fall through to "No additional details available", followed by a
 * divider and a bold "Why am I seeing this?" heading with NOTHING under it — a
 * heading introducing empty space. DW-5 #5 decided to hide the affordance
 * instead of building renderers, so callers use this to skip the panel entirely.
 */
const TYPES_WITH_METADATA = new Set([
  'spending_increase',
  'budget_recommendation',
  'unusual_expense',
  'positive_reinforcement',
]);

export function hasInsightMetadata(insight: Pick<Insight, 'type'>): boolean {
  return TYPES_WITH_METADATA.has(insight.type);
}

export function InsightMetadata({ insight }: InsightMetadataProps) {
  const t = useTranslations('insights');
  // Dates in the panel follow the UI language too — the shared helper, not
  // a fifth inlined `locale === 'bg' ? bg : undefined`.
  const locale = useLocale();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format;
  const metadata = insight.metadata as Record<string, unknown>;

  // Render metadata based on insight type
  const renderTypeSpecificMetadata = () => {
    switch (insight.type) {
      case 'spending_increase': {
        const meta = metadata as unknown as SpendingIncreaseMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('meta_spending_details_for', { category: meta.category_name ?? t('meta_unknown_category') })}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={4} w="full">
              <MetadataField
                label={t('meta_current_month')}
                value={
                  <>
                    {formatCurrency(meta.current_amount ?? 0, undefined, currencyCode)}
                    <Badge ml={2} bg="surface.sunken" color="fg.muted" fontSize="xs">
                      {meta.transaction_count_current ?? 0} transactions
                    </Badge>
                  </>
                }
              />
              <MetadataField
                label={t('meta_previous_month')}
                value={
                  <>
                    {formatCurrency(meta.previous_amount ?? 0, undefined, currencyCode)}
                    <Badge ml={2} bg="surface.sunken" color="fg.muted" fontSize="xs">
                      {meta.transaction_count_previous ?? 0} transactions
                    </Badge>
                  </>
                }
              />
              <MetadataField
                label={t('meta_absolute_change')}
                value={formatCurrency((meta.current_amount ?? 0) - (meta.previous_amount ?? 0), undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label={t('meta_percentage_change')}
                value={formatPercent(meta.percent_change ?? 0)}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="fg.subtle">
              <Text>{t('meta_period', { value: formatMonth(meta.current_month ?? t('meta_not_available')) })}</Text>
              <Text>{t('meta_compared_to', { value: formatMonth(meta.previous_month ?? t('meta_not_available')) })}</Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.current_month && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.current_month)}
                style={{
                  color: 'var(--chakra-colors-accent)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {t('meta_view_transactions')} <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'budget_recommendation': {
        const meta = metadata as unknown as BudgetRecommendationMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('meta_budget_recommendation_for', { category: meta.category_name ?? t('meta_unknown_category') })}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={4} w="full">
              <MetadataField
                label={t('meta_three_month_average')}
                value={formatCurrency(meta.three_month_average ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label={t('meta_recommended_budget')}
                value={formatCurrency(meta.recommended_budget ?? 0, undefined, currencyCode)}
                highlight
              />
            </Grid>

            <Box bg="accent.subtle" p={3} borderRadius="md" w="full">
              <Text fontSize="xs" color="accent">
                {meta.calculation_explanation ?? 'Budget recommendation based on spending history'}
              </Text>
            </Box>

            <Box fontSize="xs" color="fg.subtle">
              <Text>
                {t('meta_based_on_spending_in', {
                  months:
                    meta.months_analyzed?.map(formatMonth).join(', ') ??
                    t('meta_not_available'),
                })}
              </Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.months_analyzed && meta.months_analyzed.length > 0 && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.months_analyzed[meta.months_analyzed.length - 1] ?? '')}
                style={{
                  color: 'var(--chakra-colors-accent)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {t('meta_view_transactions')} <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'unusual_expense': {
        const meta = metadata as unknown as UnusualExpenseMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('meta_unusual_expense_in', { category: meta.category_name ?? t('meta_unknown_category') })}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={4} w="full">
              <MetadataField
                label={t('meta_transaction_amount')}
                value={formatCurrency(meta.transaction_amount ?? 0, undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label={t('meta_category_average')}
                value={formatCurrency(meta.category_average ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label={t('meta_standard_deviation')}
                value={formatCurrency(meta.standard_deviation ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label={t('meta_deviation')}
                value={`${(meta.std_devs_from_mean ?? 0).toFixed(1)} σ above average`}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="fg.subtle">
              <Text>
                {t('meta_transaction_date', {
                  value: meta.transaction_date
                    ? format(new Date(meta.transaction_date), 'PPP', {
                        locale: getDateLocale(locale),
                      })
                    : t('meta_not_available'),
                })}
              </Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.transaction_date && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.transaction_date.substring(0, 7))}
                style={{
                  color: 'var(--chakra-colors-accent)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {t('meta_view_transactions')} <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'positive_reinforcement': {
        const meta = metadata as unknown as PositiveReinforcementMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('meta_budget_performance_for', { category: meta.category_name ?? t('meta_unknown_category') })}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={4} w="full">
              <MetadataField
                label={t('meta_budget_limit')}
                value={formatCurrency(meta.budget_amount ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label={t('meta_actual_spending')}
                value={formatCurrency(meta.actual_spending ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label={t('meta_savings')}
                value={formatCurrency(meta.savings_amount ?? 0, undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label={t('meta_under_budget')}
                value={formatPercent(meta.percent_under_budget ?? 0)}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="fg.subtle">
              <Text>{t('meta_period', { value: formatMonth(meta.current_month ?? t('meta_not_available')) })}</Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.current_month && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.current_month)}
                style={{
                  color: 'var(--chakra-colors-accent)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                {t('meta_view_transactions')} <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      default:
        // Unreachable in practice: `hasInsightMetadata` gates the whole panel,
        // so a type with no renderer never gets here.
        return null;
    }
  };

  // Render "Why am I seeing this?" explanation
  const renderExplanation = () => {
    switch (insight.type) {
      case 'spending_increase':
        return (
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            {t('meta_why_spending_increase')}
          </Text>
        );

      case 'budget_recommendation':
        return (
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            {t('meta_why_budget_recommendation')}
          </Text>
        );

      case 'unusual_expense':
        return (
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            {t('meta_why_unusual_expense')}
          </Text>
        );

      case 'positive_reinforcement':
        return (
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            {t('meta_why_positive_reinforcement')}
          </Text>
        );

      default:
        return null;
    }
  };

  // Nothing to show means nothing at all — not a divider and a heading over
  // empty space, which is what this rendered before.
  if (!hasInsightMetadata(insight)) return null;

  return (
    <VStack align="start" spacing={5} w="full">
      {/* Type-specific metadata */}
      {renderTypeSpecificMetadata()}

      <Divider />

      {/* Why am I seeing this? */}
      <Box w="full">
        <Text fontSize="sm" fontWeight="bold" color="fg" mb={2}>
          {t('meta_why_heading')}
        </Text>
        {renderExplanation()}
      </Box>
    </VStack>
  );
}
