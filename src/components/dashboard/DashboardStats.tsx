'use client';

/**
 * DashboardStats Component
 * Story 5.2: Financial Summary Cards
 *
 * Container component that displays 3 StatCards: Balance, Income, Expenses
 * Includes real-time updates via Supabase Realtime subscriptions
 */

import { useEffect } from 'react';
import { SimpleGrid, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';
import { StatCard } from './StatCard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { formatCurrency, formatCurrencyWithSign } from '@/lib/utils/currency';
import { createClient } from '@/lib/supabase/client';

export function DashboardStats() {
  const { data, error, isLoading, mutate } = useDashboardStats();
  const supabase = createClient();

  // Subscribe to real-time transaction changes
  useEffect(() => {
    // Create a channel for transactions table changes
    const channel = supabase
      .channel('dashboard-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('[DashboardStats] Realtime update received:', payload.eventType);
          // Revalidate dashboard stats immediately when any transaction changes
          // Force revalidation to bypass cache
          mutate();
        }
      )
      .subscribe((status) => {
        console.log('[DashboardStats] Realtime subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('[DashboardStats] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [supabase, mutate]);

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
    <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} w="full">
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
