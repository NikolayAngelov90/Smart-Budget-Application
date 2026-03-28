'use client';

/**
 * Dashboard Page
 * Story 5.1: Dashboard Layout and Navigation
 * Story 5.2: Financial Summary Cards
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 * Story 5.4: Spending Trends Over Time (Line Chart)
 * Story 5.5: Month-over-Month Comparison Highlights
 * Story 7.2: Performance Monitoring (Performance marks)
 *
 * Main dashboard landing page that displays financial overview.
 * This page will be populated with charts and metrics in subsequent stories.
 */

import { useEffect, useCallback, useState } from 'react';
import { Box, Heading, Text, VStack, Grid, Flex, Spinner } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { mutate } from 'swr';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { AIBudgetCoach } from '@/components/dashboard/AIBudgetCoach';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { CategorySpendingChart } from '@/components/dashboard/CategorySpendingChart';
import { SpendingTrendsChart } from '@/components/dashboard/SpendingTrendsChart';
import { MonthOverMonth } from '@/components/dashboard/MonthOverMonth';
import { SpendingHeatmap } from '@/components/ai/SpendingHeatmap';
import { AnnualizedProjections } from '@/components/ai/AnnualizedProjections';
import { FirstTransactionPrompt } from '@/components/dashboard/FirstTransactionPrompt';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { preferences } = useUserPreferences();
  const { data: stats } = useDashboardStats(undefined, preferences?.currency_format);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Story 11.1: Show FirstTransactionPrompt when user has no transactions
  const hasNoTransactions = stats && stats.income.current === 0 && stats.expenses.current === 0 && stats.balance === 0;

  // AC-10.8.4: Pull-to-refresh — revalidate all dashboard SWR keys
  const { containerRef: dashboardRef, isRefreshing } = usePullToRefresh(
    useCallback(async () => {
      const now = new Date();
      const heatmapKey = `/api/heatmap?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
      await Promise.all([
        mutate('/api/dashboard/stats', undefined, { revalidate: true }),
        mutate('/api/dashboard/spending-by-category', undefined, { revalidate: true }),
        mutate('/api/dashboard/trends', undefined, { revalidate: true }),
        mutate(heatmapKey, undefined, { revalidate: true }),
        mutate('/api/dashboard/annualized-projections', undefined, { revalidate: true }),
      ]);
    }, [])
  );

  // Performance monitoring: Mark dashboard render start
  useEffect(() => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark('dashboard-render-start');
    }
  }, []);

  // Performance monitoring: Mark dashboard render end and measure
  useEffect(() => {
    if (typeof window !== 'undefined' && window.performance) {
      // Wait for next tick to ensure DOM is rendered
      const timeoutId = setTimeout(() => {
        performance.mark('dashboard-render-end');

        // Measure the time between start and end
        try {
          performance.measure(
            'dashboard-render',
            'dashboard-render-start',
            'dashboard-render-end'
          );

          // Get the measurement
          const measurements = performance.getEntriesByName('dashboard-render');
          const lastMeasurement = measurements[measurements.length - 1];
          if (lastMeasurement) {
            const renderTime = lastMeasurement.duration;
            console.log(`📊 Dashboard render time: ${Math.round(renderTime)}ms`);

            // Vercel Analytics automatically captures these performance marks
            // Check if it exceeds 2s threshold
            if (renderTime > 2000) {
              console.warn(`⚠️ Dashboard render time exceeds 2s threshold: ${Math.round(renderTime)}ms`);
            }
          }
        } catch (error) {
          // Silently fail if marks don't exist
          console.debug('Performance measurement failed:', error);
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  });

  return (
    <Box ref={dashboardRef} maxW="1200px" mx="auto" w="full">
      {/* AC-10.8.4: Pull-to-refresh indicator */}
      {isRefreshing && (
        <Flex justify="center" py={3}>
          <Spinner size="sm" color="trustBlue.500" />
        </Flex>
      )}
      <VStack align="start" spacing={{ base: 4, md: 6 }} mb={{ base: 6, md: 8 }}>
        <Heading
          as="h1"
          fontSize={{ base: '2rem', lg: '2.5rem' }}
          color="gray.800"
        >
          {t('title')}
        </Heading>
        <Text fontSize={{ base: '0.875rem', lg: '1rem' }} color="gray.600">
          {t('subtitle')}
        </Text>
      </VStack>

      {/* Story 11.1: First Transaction Prompt — shown when user has 0 transactions */}
      {hasNoTransactions && (
        <Box mb={{ base: 6, md: 8 }}>
          <FirstTransactionPrompt onAddTransaction={() => setIsTransactionModalOpen(true)} />
        </Box>
      )}

      {/* Financial Summary Cards - Story 5.2 */}
      <Box mb={{ base: 6, md: 8 }}>
        <DashboardStats />
      </Box>

      {/* AI Budget Coach - Story 6.2 */}
      <AIBudgetCoach />

      {/* Charts Grid - Story 5.8: Responsive layout for charts */}
      <Grid
        templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
        gap={{ base: 6, md: 8 }}
        mb={{ base: 6, md: 8 }}
      >
        {/* Category Spending Chart - Story 5.3 */}
        <Box>
          <Heading
            as="h2"
            fontSize={{ base: '1.25rem', lg: '1.5rem' }}
            mb={4}
            color="gray.700"
          >
            {t('spendingByCategory')}
          </Heading>
          <CategorySpendingChart chartType="donut" height={300} />
        </Box>

        {/* Spending Trends Chart - Story 5.4 */}
        <Box>
          <Heading
            as="h2"
            fontSize={{ base: '1.25rem', lg: '1.5rem' }}
            mb={4}
            color="gray.700"
          >
            {t('spendingTrends')}
          </Heading>
          <SpendingTrendsChart months={6} height={300} />
        </Box>
      </Grid>

      {/* Month-over-Month Comparison - Story 5.5 */}
      <Box mb={{ base: 6, md: 8 }}>
        <MonthOverMonth />
      </Box>

      {/* Spending Heatmap - Story 11.3 (progressive disclosure: renders null if <7 days of data) */}
      <Box mb={{ base: 6, md: 8 }}>
        <SpendingHeatmap />
      </Box>

      {/* Annualized Spending Projections - Story 11.4 (progressive disclosure: renders null if <1 complete past month) */}
      <Box mb={{ base: 6, md: 8 }}>
        <AnnualizedProjections />
      </Box>

      {/* Story 11.1: Transaction Entry Modal triggered from FirstTransactionPrompt */}
      <TransactionEntryModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={async () => {
          setIsTransactionModalOpen(false);
          await Promise.all([
            mutate('/api/dashboard/stats', undefined, { revalidate: true }),
            mutate('/api/dashboard/spending-by-category', undefined, { revalidate: true }),
            mutate('/api/dashboard/trends', undefined, { revalidate: true }),
          ]);
        }}
      />
    </Box>
  );
}
