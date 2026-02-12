'use client';

/**
 * DashboardStats Component
 * Story 5.2: Financial Summary Cards
 * Story 7.3: Refactored to use centralized Realtime subscription manager
 *
 * Container component that displays 3 StatCards: Balance, Income, Expenses
 * Includes real-time updates via centralized Realtime subscription manager
 */

import { SimpleGrid, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { StatCard } from './StatCard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency, formatCurrencyWithSign } from '@/lib/utils/currency';

export function DashboardStats() {
  const { data, error, isLoading, mutate } = useDashboardStats();
  const { preferences } = useUserPreferences();
  const t = useTranslations('dashboard');
  const currencyCode = preferences?.currency_format;

  // Subscribe to real-time transaction changes via centralized manager
  useRealtimeSubscription((event) => {
    console.log('[DashboardStats] Realtime update received:', event.eventType);
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
  const incomeFormatted = formatCurrencyWithSign(incomeCurrent, true, undefined, currencyCode);
  const incomeTrend = data?.income.trend ?? 0;

  const expensesCurrent = data?.expenses.current ?? 0;
  const expensesFormatted = formatCurrencyWithSign(-expensesCurrent, true, undefined, currencyCode);
  const expensesTrend = data?.expenses.trend ?? 0;

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 4, md: 6 }} w="full">
      {/* Total Balance Card */}
      <StatCard
        label={t('totalBalance')}
        value={balanceFormatted}
        trend={incomeTrend - expensesTrend}
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
        isLoading={isLoading}
      />
    </SimpleGrid>
  );
}
