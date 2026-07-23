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
import { Box, Heading, Grid, Flex, Spinner, Button, Divider, VisuallyHidden } from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
// useSWRConfig().mutate is scoped to the app's localStorage cache provider —
// the module-level `mutate` export binds to SWR's DEFAULT cache and never
// reaches the hooks (proven in the 15-1 review; the revalidations below were
// silently inert with the global import).
import { useSWRConfig } from 'swr';
import { BalanceFlowHero } from '@/components/dashboard/BalanceFlowHero';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
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
import { BudgetScoreRing } from '@/components/dashboard/BudgetScoreRing';
import { SCORE_KEY } from '@/lib/hooks/useBudgetScore';
import { ComebackChallengeCard } from '@/components/dashboard/ComebackChallengeCard';
import { COMEBACK_KEY } from '@/lib/hooks/useComeback';
import { advanceStreak, localDayKey } from '@/lib/ai/streakEngine';
import type { StreakResponse } from '@/types/database.types';
import { FirstTransactionPrompt } from '@/components/dashboard/FirstTransactionPrompt';
import { FeatureIntroCard } from '@/components/dashboard/FeatureIntroCard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { mutate } = useSWRConfig();
  const { preferences } = useUserPreferences();
  const { data: stats } = useDashboardStats(undefined, preferences?.currency_format);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  // Progressive disclosure: the advanced forecast/projection tail is collapsed
  // by default so the dashboard stays scannable (FR / brief §5E, §9).
  const [showAhead, setShowAhead] = useState(false);

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
        // Story 15.6: skip the gamification revalidations when opted out — the
        // null-key hooks don't subscribe, and firing these would trigger the
        // score/comeback GETs (server achievement eval / create-on-read) from
        // an opted-out browser. `?? true` matches the gate's opt-out default.
        ...(preferences?.gamification_enabled ?? true
          ? [
              mutate(STREAK_KEY, undefined, { revalidate: true }),
              mutate(SCORE_KEY, undefined, { revalidate: true }),
              mutate(COMEBACK_KEY, undefined, { revalidate: true }),
            ]
          : []),
      ]);
    }, [mutate, preferences?.gamification_enabled])
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
    <Box ref={dashboardRef} maxW="1120px" mx="auto" w="full">
      {/* Single semantic page title for screen readers — the visible page
          identity is carried by the personalized greeting inside the hero. */}
      <VisuallyHidden>
        <Heading as="h1">{t('title')}</Heading>
      </VisuallyHidden>

      {/* AC-10.8.4: Pull-to-refresh indicator */}
      {isRefreshing && (
        <Flex justify="center" py={3}>
          <Spinner size="sm" color="accent" />
        </Flex>
      )}

      {/* Signature hero: greeting + total balance + this-month flow bar.
          Replaces the old page title + 4-up StatCard grid (Story 5.2). */}
      <Box mb={{ base: 4, md: 5 }}>
        <BalanceFlowHero />
      </Box>

      {/* Story 15.1: logging streak — single mount point (15-6 opt-out gates here).
          Sits as a compact chip under the hero. Small margin keeps the phantom
          gap minimal when the badge self-hides (opted out / no streak). */}
      <Flex justify="flex-end" mb={{ base: 2, md: 3 }}>
        <StreakBadge />
      </Flex>

      {/* Welcome-back summary - Story 12.6 (progressive disclosure: returning lapsed users) */}
      <Box mb={{ base: 6, md: 8 }}>
        <ReengagementSummary />
      </Box>

      {/* Story 15.7: feature-introduction announcement — single mount point,
          renders null unless a usage threshold has newly been crossed. Carries
          its own bottom margin so a non-pending user gets no phantom gap. */}
      <FeatureIntroCard />

      {/* Story 11.1: First Transaction Prompt — shown when user has 0 transactions */}
      {hasNoTransactions && (
        <Box mb={{ base: 6, md: 8 }}>
          <FirstTransactionPrompt onAddTransaction={() => setIsTransactionModalOpen(true)} />
        </Box>
      )}

      {/* Story 15.4: comeback challenge — returning users see it first;
          renders null unless a challenge is active (single mount, 15-6 gates) */}
      <ComebackChallengeCard />

      {/* Story 15.2: Budget Score — single mount point (15-6 opt-out gates here);
          renders null until the user has scoreable data */}
      <BudgetScoreRing />

      {/* Budget Health - ADR-025 (progressive disclosure: renders null with no budgets;
          carries its own bottom margin so zero-budget users get no phantom gap) */}
      <BudgetHealthCard />

      {/* AI Budget Coach - Story 6.2 (self-titled card) */}
      <AIBudgetCoach />

      {/* ── Where it's going ──────────────────────────────────────────────── */}
      <Box as="section" mb={{ base: 8, md: 10 }}>
        <SectionHeader eyebrow={t('thisMonth')} title={t('sectionWhereGoing')} />
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: 5, md: 6 }}
        >
          {/* Category Spending Chart - Story 5.3 */}
          <Box>
            <Heading as="h3" fontSize="md" fontWeight={600} mb={3} color="fg.muted">
              {t('spendingByCategory')}
            </Heading>
            <CategorySpendingChart chartType="donut" height={300} />
          </Box>

          {/* Spending Trends Chart - Story 5.4 */}
          <Box>
            <Heading as="h3" fontSize="md" fontWeight={600} mb={3} color="fg.muted">
              {t('spendingTrends')}
            </Heading>
            <SpendingTrendsChart months={6} height={300} />
          </Box>
        </Grid>
      </Box>

      {/* Recent Transactions — latest activity at a glance (self-titled card) */}
      <Box mb={{ base: 6, md: 8 }}>
        <RecentTransactions />
      </Box>

      {/* Month-over-Month Comparison - Story 5.5 (self-titled card) */}
      <Box mb={{ base: 6, md: 8 }}>
        <MonthOverMonth />
      </Box>

      {/* ── Looking ahead — advanced forecasts, collapsed by default ───────────
          Progressive disclosure: gated to users who have transactions (a brand-new
          user has no forecast data, so we never show an empty "Show more"). */}
      {!hasNoTransactions && (
        <Box as="section" mb={{ base: 6, md: 8 }}>
          <Divider mb={{ base: 6, md: 8 }} />
          <SectionHeader
            eyebrow={t('sectionAheadHint')}
            title={t('sectionAhead')}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAhead((v) => !v)}
                rightIcon={showAhead ? <ChevronUpIcon /> : <ChevronDownIcon />}
                aria-expanded={showAhead}
              >
                {showAhead ? t('showLess') : t('showMore')}
              </Button>
            }
          />

          {showAhead && (
            <Box>
              {/* Spending by Value - Story 14.2 (renders null if no values plan) */}
              <Box mb={{ base: 6, md: 8 }}>
                <ValuesSpendingCard />
              </Box>

              {/* Spending Heatmap - Story 11.3 (renders null if <7 days of data) */}
              <Box mb={{ base: 6, md: 8 }}>
                <SpendingHeatmap />
              </Box>

              {/* Annualized Spending Projections - Story 11.4 */}
              <Box mb={{ base: 6, md: 8 }}>
                <AnnualizedProjections />
              </Box>

              {/* End-of-Month Budget Forecast - Story 12.2 */}
              <Box mb={{ base: 6, md: 8 }}>
                <BudgetForecast />
              </Box>

              {/* 30-Day Budget Recovery Plan - Story 12.4 */}
              <Box mb={{ base: 6, md: 8 }}>
                <RecoveryPlan />
              </Box>

              {/* Seasonal Spending Outlook - Story 12.5 */}
              <Box mb={{ base: 6, md: 8 }}>
                <SeasonalAwareness />
              </Box>

              {/* Weekly Digest - Story 11.7 (renders null if no digest yet) */}
              <Box mb={{ base: 6, md: 8 }}>
                <WeeklyDigestCard />
              </Box>
            </Box>
          )}
        </Box>
      )}

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
            // Story 15.2 AC #4: the score updates after each transaction
            mutate(SCORE_KEY, undefined, { revalidate: true }),
            // Story 15.4: challenge progress advances with each log
            mutate(COMEBACK_KEY, undefined, { revalidate: true }),
          ]);
        }}
      />
    </Box>
  );
}
