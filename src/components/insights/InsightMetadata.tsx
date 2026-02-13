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
        <Text fontSize="xs" color="gray.500" fontWeight="medium">
          {label}
        </Text>
        <Text
          fontSize="md"
          fontWeight={highlight ? 'bold' : 'semibold'}
          color={highlight ? 'blue.600' : 'gray.800'}
        >
          {value}
        </Text>
      </VStack>
    </GridItem>
  );
}

export function InsightMetadata({ insight }: InsightMetadataProps) {
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
            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
              Spending Details for {meta.category_name ?? 'Unknown Category'}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} w="full">
              <MetadataField
                label="Current Month"
                value={
                  <>
                    {formatCurrency(meta.current_amount ?? 0, undefined, currencyCode)}
                    <Badge ml={2} colorScheme="gray" fontSize="xs">
                      {meta.transaction_count_current ?? 0} transactions
                    </Badge>
                  </>
                }
              />
              <MetadataField
                label="Previous Month"
                value={
                  <>
                    {formatCurrency(meta.previous_amount ?? 0, undefined, currencyCode)}
                    <Badge ml={2} colorScheme="gray" fontSize="xs">
                      {meta.transaction_count_previous ?? 0} transactions
                    </Badge>
                  </>
                }
              />
              <MetadataField
                label="Absolute Change"
                value={formatCurrency((meta.current_amount ?? 0) - (meta.previous_amount ?? 0), undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label="Percentage Change"
                value={formatPercent(meta.percent_change ?? 0)}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="gray.500">
              <Text>Period: {formatMonth(meta.current_month ?? 'N/A')}</Text>
              <Text>Compared to: {formatMonth(meta.previous_month ?? 'N/A')}</Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.current_month && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.current_month)}
                style={{
                  color: 'var(--chakra-colors-blue-600)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View these transactions <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'budget_recommendation': {
        const meta = metadata as unknown as BudgetRecommendationMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
              Budget Recommendation for {meta.category_name ?? 'Unknown Category'}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} w="full">
              <MetadataField
                label="3-Month Average"
                value={formatCurrency(meta.three_month_average ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label="Recommended Budget"
                value={formatCurrency(meta.recommended_budget ?? 0, undefined, currencyCode)}
                highlight
              />
            </Grid>

            <Box bg="blue.50" p={3} borderRadius="md" w="full">
              <Text fontSize="xs" color="blue.800">
                {meta.calculation_explanation ?? 'Budget recommendation based on spending history'}
              </Text>
            </Box>

            <Box fontSize="xs" color="gray.500">
              <Text>
                Based on spending in:{' '}
                {meta.months_analyzed?.map(formatMonth).join(', ') ?? 'N/A'}
              </Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.months_analyzed && meta.months_analyzed.length > 0 && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.months_analyzed[meta.months_analyzed.length - 1] ?? '')}
                style={{
                  color: 'var(--chakra-colors-blue-600)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View these transactions <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'unusual_expense': {
        const meta = metadata as unknown as UnusualExpenseMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
              Unusual Expense in {meta.category_name ?? 'Unknown Category'}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} w="full">
              <MetadataField
                label="Transaction Amount"
                value={formatCurrency(meta.transaction_amount ?? 0, undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label="Category Average"
                value={formatCurrency(meta.category_average ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label="Standard Deviation"
                value={formatCurrency(meta.standard_deviation ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label="Deviation"
                value={`${(meta.std_devs_from_mean ?? 0).toFixed(1)} σ above average`}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="gray.500">
              <Text>Transaction Date: {meta.transaction_date ? format(new Date(meta.transaction_date), 'PPP') : 'N/A'}</Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.transaction_date && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.transaction_date.substring(0, 7))}
                style={{
                  color: 'var(--chakra-colors-blue-600)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View these transactions <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      case 'positive_reinforcement': {
        const meta = metadata as unknown as PositiveReinforcementMetadata;
        return (
          <VStack align="start" spacing={4} w="full">
            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
              Budget Performance for {meta.category_name ?? 'Unknown Category'}
            </Text>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} w="full">
              <MetadataField
                label="Budget Limit"
                value={formatCurrency(meta.budget_amount ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label="Actual Spending"
                value={formatCurrency(meta.actual_spending ?? 0, undefined, currencyCode)}
              />
              <MetadataField
                label="Savings"
                value={formatCurrency(meta.savings_amount ?? 0, undefined, currencyCode)}
                highlight
              />
              <MetadataField
                label="Under Budget"
                value={formatPercent(meta.percent_under_budget ?? 0)}
                highlight
              />
            </Grid>

            <Box fontSize="xs" color="gray.500">
              <Text>Period: {formatMonth(meta.current_month ?? 'N/A')}</Text>
            </Box>

            {/* Transaction Link */}
            {meta.category_id && meta.current_month && (
              <Link
                href={buildTransactionLink(meta.category_id, meta.current_month)}
                style={{
                  color: 'var(--chakra-colors-blue-600)',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                View these transactions <ArrowForwardIcon ml={1} />
              </Link>
            )}
          </VStack>
        );
      }

      default:
        return (
          <Text fontSize="sm" color="gray.500">
            No additional details available for this insight type.
          </Text>
        );
    }
  };

  // Render "Why am I seeing this?" explanation
  const renderExplanation = () => {
    switch (insight.type) {
      case 'spending_increase':
        return (
          <Text fontSize="sm" color="gray.600" lineHeight="tall">
            You're seeing this because your spending in this category increased by more than
            20% compared to last month. We calculate this by comparing your total spending in
            each category month-over-month to help you spot unusual spending patterns early.
          </Text>
        );

      case 'budget_recommendation':
        return (
          <Text fontSize="sm" color="gray.600" lineHeight="tall">
            You're seeing this because you don't have a budget set for this category, but
            you've been spending consistently here. We calculated the recommended budget by
            taking your average spending over the last 3 months and adding a 10% buffer to
            give you flexibility.
          </Text>
        );

      case 'unusual_expense':
        return (
          <Text fontSize="sm" color="gray.600" lineHeight="tall">
            You're seeing this because we detected a transaction that's significantly higher
            than your typical spending in this category. We use statistical analysis to
            identify expenses that are more than 2 standard deviations above your category
            average, which helps catch potential errors or unexpected charges.
          </Text>
        );

      case 'positive_reinforcement':
        return (
          <Text fontSize="sm" color="gray.600" lineHeight="tall">
            You're seeing this because you stayed under your budget limit for this category!
            We want to celebrate your success and encourage this positive behavior. Keep up
            the great work managing your spending.
          </Text>
        );

      default:
        return null;
    }
  };

  return (
    <VStack align="start" spacing={5} w="full">
      {/* Type-specific metadata */}
      {renderTypeSpecificMetadata()}

      <Divider />

      {/* Why am I seeing this? */}
      <Box w="full">
        <Text fontSize="sm" fontWeight="bold" color="gray.700" mb={2}>
          Why am I seeing this?
        </Text>
        {renderExplanation()}
      </Box>
    </VStack>
  );
}
