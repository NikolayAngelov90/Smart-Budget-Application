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
// useSWRConfig().mutate is scoped to the app's localStorage cache provider —
// the module-level `mutate` export binds to SWR's DEFAULT cache and never
// reaches the hooks (proven in the 15-1 review; the revalidations below were
// silently inert with the global import).
import { useSWRConfig } from 'swr';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { AIBudgetCoach } from '@/components/dashboard/AIBudgetCoach';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { CategorySpendingChart } from '@/components/dashboard/CategorySpendingChart';
import { SpendingTrendsChart } from '@/components/dashboard/SpendingTrendsChart';
import { MonthOverMonth } from '@/components/dashboard/MonthOverMonth';
import { SpendingHeatmap } from '@/components/ai/SpendingHeatmap';
import { AnnualizedProjections } from '@/components/ai/AnnualizedProjections';
import { BudgetForecast } from '@/components/ai/BudgetForecast';
import { RecoveryPlan } from '@/components/ai/RecoveryPlan';
import { SeasonalAwareness } from '@/components/ai/SeasonalAwareness';
import { ReengagementSummary } from '@/components/ai/ReengagementSummary';
import { WeeklyDigestCard } from '@/components/ai/WeeklyDigestCard';
import { ValuesSpendingCard } from '@/components/values/ValuesSpendingCard';
import { RecentTransactions, RECENT_TRANSACTIONS_KEY } from '@/components/dashboard/RecentTransactions';
import { BudgetHealthCard } from '@/components/dashboard/BudgetHealthCard';
import { BUDGETS_KEY } from '@/lib/hooks/useBudgets';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { STREAK_KEY } from '@/lib/hooks/useStreak';
import { advanceStreak, localDayKey } from '@/lib/ai/streakEngine';
import type { StreakResponse } from '@/types/database.types';
import { FirstTransactionPrompt } from '@/components/dashboard/FirstTransactionPrompt';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { mutate } = useSWRConfig();
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
        mutate('/api/dashboard/budget-forecast', undefined, { revalidate: true }),
        mutate('/api/recovery-plan', undefined, { revalidate: true }),
        mutate('/api/dashboard/seasonal', undefined, { revalidate: true }),
        mutate('/api/reengagement', undefined, { revalidate: true }),
        mutate('/api/user/digest', undefined, { revalidate: true }),
        mutate('/api/values/spending', undefined, { revalidate: true }),
        mutate(RECENT_TRANSACTIONS_KEY, undefined, { revalidate: true }),
        mutate(BUDGETS_KEY, undefined, { revalidate: true }),
        mutate(STREAK_KEY, undefined, { revalidate: true }),
      ]);
    }, [mutate])
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
        <Flex
          w="full"
          justify="space-between"
          align="center"
          gap={3}
          flexWrap="wrap"
        >
          <Heading
            as="h1"
            fontSize={{ base: '2rem', lg: '2.5rem' }}
            color="gray.800"
          >
            {t('title')}
          </Heading>
          {/* Story 15.1: logging streak — single mount point (15-6 opt-out gates here) */}
          <StreakBadge />
        </Flex>
        <Text fontSize={{ base: '0.875rem', lg: '1rem' }} color="gray.600">
          {t('subtitle')}
        </Text>
      </VStack>

      {/* Welcome-back summary - Story 12.6 (progressive disclosure: returning lapsed users) */}
      <Box mb={{ base: 6, md: 8 }}>
        <ReengagementSummary />
      </Box>

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

      {/* Budget Health - ADR-025 (progressive disclosure: renders null with no budgets;
          carries its own bottom margin so zero-budget users get no phantom gap) */}
      <BudgetHealthCard />

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

      {/* Recent Transactions — latest activity at a glance */}
      <Box mb={{ base: 6, md: 8 }}>
        <RecentTransactions />
      </Box>

      {/* Month-over-Month Comparison - Story 5.5 */}
      <Box mb={{ base: 6, md: 8 }}>
        <MonthOverMonth />
      </Box>

      {/* Spending by Value - Story 14.2 (progressive disclosure: renders null if no values plan) */}
      <Box mb={{ base: 6, md: 8 }}>
        <ValuesSpendingCard />
      </Box>

      {/* Spending Heatmap - Story 11.3 (progressive disclosure: renders null if <7 days of data) */}
      <Box mb={{ base: 6, md: 8 }}>
        <SpendingHeatmap />
      </Box>

      {/* Annualized Spending Projections - Story 11.4 (progressive disclosure: renders null if <1 complete past month) */}
      <Box mb={{ base: 6, md: 8 }}>
        <AnnualizedProjections />
      </Box>

      {/* End-of-Month Budget Forecast - Story 12.2 (progressive disclosure) */}
      <Box mb={{ base: 6, md: 8 }}>
        <BudgetForecast />
      </Box>

      {/* 30-Day Budget Recovery Plan - Story 12.4 (progressive disclosure) */}
      <Box mb={{ base: 6, md: 8 }}>
        <RecoveryPlan />
      </Box>

      {/* Seasonal Spending Outlook - Story 12.5 (progressive disclosure) */}
      <Box mb={{ base: 6, md: 8 }}>
        <SeasonalAwareness />
      </Box>

      {/* Weekly Digest - Story 11.7 (progressive disclosure: renders null if no digest yet) */}
      <Box mb={{ base: 6, md: 8 }}>
        <WeeklyDigestCard />
      </Box>

      {/* Story 11.1: Transaction Entry Modal triggered from FirstTransactionPrompt */}
      <TransactionEntryModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={async () => {
          setIsTransactionModalOpen(false);
          // Story 15.1 AC #3: optimistic streak bump via the CLIENT-side engine —
          // instant (<100ms, no network), then background revalidation reconciles
          // with server truth (the POST already recorded it server-side).
          // Only advance an EXISTING cached streak: fabricating from an empty
          // cache would flash "1-day streak" at a 30-day user (15-1 review).
          mutate<StreakResponse>(
            STREAK_KEY,
            (current) =>
              current?.streak
                ? { streak: advanceStreak(current.streak, localDayKey(new Date())).state }
                : current,
            { revalidate: true }
          ).catch(() => {
            // Revalidation failure is non-fatal; the next focus/refresh reconciles
          });
          await Promise.all([
            mutate('/api/dashboard/stats', undefined, { revalidate: true }),
            mutate('/api/dashboard/spending-by-category', undefined, { revalidate: true }),
            mutate('/api/dashboard/trends', undefined, { revalidate: true }),
            mutate('/api/values/spending', undefined, { revalidate: true }),
            mutate(RECENT_TRANSACTIONS_KEY, undefined, { revalidate: true }),
            mutate(BUDGETS_KEY, undefined, { revalidate: true }),
          ]);
        }}
      />
    </Box>
  );
}
