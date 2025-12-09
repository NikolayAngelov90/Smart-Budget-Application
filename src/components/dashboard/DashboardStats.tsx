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
import { StatCard } from './StatCard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { formatCurrency, formatCurrencyWithSign } from '@/lib/utils/currency';

export function DashboardStats() {
  const { data, error, isLoading, mutate } = useDashboardStats();

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
        <AlertTitle>Failed to load dashboard stats</AlertTitle>
        <AlertDescription>
          Unable to fetch financial data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate values and trends
  const balance = data?.balance ?? 0;
  const balanceFormatted = formatCurrency(balance);
  const balanceColorScheme = balance >= 0 ? 'green' : 'red';

  const incomeCurrent = data?.income.current ?? 0;
  const incomeFormatted = formatCurrencyWithSign(incomeCurrent, true);
  const incomeTrend = data?.income.trend ?? 0;

  const expensesCurrent = data?.expenses.current ?? 0;
  const expensesFormatted = formatCurrencyWithSign(-expensesCurrent, true);
  const expensesTrend = data?.expenses.trend ?? 0;

  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 4, md: 6 }} w="full">
      {/* Total Balance Card */}
      <StatCard
        label="Total Balance"
        value={balanceFormatted}
        trend={incomeTrend - expensesTrend}
        trendLabel="vs last month"
        colorScheme={balanceColorScheme}
        isLoading={isLoading}
      />

      {/* Monthly Income Card */}
      <StatCard
        label="Monthly Income"
        value={incomeFormatted}
        trend={incomeTrend}
        trendLabel="vs last month"
        colorScheme="green"
        isLoading={isLoading}
      />

      {/* Monthly Expenses Card */}
      <StatCard
        label="Monthly Expenses"
        value={expensesFormatted}
        trend={expensesTrend}
        trendLabel="vs last month"
        colorScheme="red"
        isLoading={isLoading}
      />
    </SimpleGrid>
  );
}
