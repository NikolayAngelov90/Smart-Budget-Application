'use client';

/**
 * DashboardStats Component
 * Story 5.2: Financial Summary Cards
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 *
 * Container component that displays 4 StatCards: Balance, Income, Expenses, Savings Rate
 * Includes real-time updates via centralized Realtime subscription manager
 */

import { SimpleGrid, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { StatCard } from './StatCard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency, formatCurrencyWithSign, calculateTrend } from '@/lib/utils/currency';

/** Savings rate = (income - expenses) / income, as a percentage. Null when there is no income. */
function savingsRateFor(income: number, expenses: number): number | null {
  if (income <= 0) return null;
  return ((income - expenses) / income) * 100;
}

export function DashboardStats() {
  const { preferences } = useUserPreferences();
  const t = useTranslations('dashboard');
  const currencyCode = preferences?.currency_format;
  const { data, error, isLoading, mutate } = useDashboardStats(undefined, currencyCode);

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription(() => {
    // Revalidate dashboard stats immediately when any transaction changes
    mutate();
  });

  // Error state
  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <AlertTitle>{t('failedToLoad')}</AlertTitle>
        <AlertDescription>
          {t('failedToLoadDescription')}
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate values and trends
  const balance = data?.balance ?? 0;
  const balanceFormatted = formatCurrency(balance, undefined, currencyCode);
  const balanceColorScheme = balance >= 0 ? 'green' : 'red';

  const incomeCurrent = data?.income.current ?? 0;
  const incomePrevious = data?.income.previous ?? 0;
  const incomeFormatted = formatCurrencyWithSign(incomeCurrent, true, undefined, currencyCode);
  const incomeTrend = data?.income.trend ?? 0;

  const expensesCurrent = data?.expenses.current ?? 0;
  const expensesPrevious = data?.expenses.previous ?? 0;
  const expensesFormatted = formatCurrencyWithSign(-expensesCurrent, true, undefined, currencyCode);
  const expensesTrend = data?.expenses.trend ?? 0;

  // Balance trend compares this month's net balance against last month's net balance
  const previousBalance = incomePrevious - expensesPrevious;
  const balanceTrend = calculateTrend(balance, previousBalance);

  // Savings rate: share of income kept after expenses; trend is the change in percentage points
  const savingsRate = savingsRateFor(incomeCurrent, expensesCurrent);
  const previousSavingsRate = savingsRateFor(incomePrevious, expensesPrevious);
  const savingsRateTrend =
    savingsRate !== null && previousSavingsRate !== null ? savingsRate - previousSavingsRate : 0;

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={{ base: 4, md: 6 }} w="full">
      {/* Total Balance Card */}
      <StatCard
        label={t('totalBalance')}
        value={balanceFormatted}
        trend={balanceTrend}
        trendLabel={t('vsLastMonth')}
        colorScheme={balanceColorScheme}
        isLoading={isLoading}
      />

      {/* Monthly Income Card */}
      <StatCard
        label={t('monthlyIncome')}
        value={incomeFormatted}
        trend={incomeTrend}
        trendLabel={t('vsLastMonth')}
        colorScheme="green"
        isLoading={isLoading}
      />

      {/* Monthly Expenses Card */}
      <StatCard
        label={t('monthlyExpenses')}
        value={expensesFormatted}
        trend={expensesTrend}
        trendLabel={t('vsLastMonth')}
        colorScheme="red"
        trendIsPositiveGood={false}
        isLoading={isLoading}
      />

      {/* Savings Rate Card */}
      <StatCard
        label={t('savingsRate')}
        value={savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '—'}
        trend={savingsRateTrend}
        trendLabel={
          savingsRate === null
            ? t('noIncomeThisMonth')
            : previousSavingsRate === null
              ? '' // no comparable rate last month — omit the comparison line
              : t('vsLastMonth')
        }
        colorScheme={savingsRate !== null && savingsRate < 0 ? 'red' : 'green'}
        showTrend={savingsRate !== null && previousSavingsRate !== null}
        isLoading={isLoading}
      />
    </SimpleGrid>
  );
}
