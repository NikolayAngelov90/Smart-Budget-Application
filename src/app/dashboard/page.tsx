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

import { useEffect } from 'react';
import { Box, Heading, Text, VStack, Grid } from '@chakra-ui/react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { AIBudgetCoach } from '@/components/dashboard/AIBudgetCoach';
import { CategorySpendingChart } from '@/components/dashboard/CategorySpendingChart';
import { SpendingTrendsChart } from '@/components/dashboard/SpendingTrendsChart';
import { MonthOverMonth } from '@/components/dashboard/MonthOverMonth';

export default function DashboardPage() {
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
          if (measurements.length > 0) {
            const renderTime = measurements[measurements.length - 1]!.duration;
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
    <Box maxW="1200px" mx="auto" w="full">
      <VStack align="start" spacing={{ base: 4, md: 6 }} mb={{ base: 6, md: 8 }}>
        <Heading
          as="h1"
          fontSize={{ base: '2rem', lg: '2.5rem' }}
          color="gray.800"
        >
          Dashboard
        </Heading>
        <Text fontSize={{ base: '0.875rem', lg: '1rem' }} color="gray.600">
          Your financial overview
        </Text>
      </VStack>

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
            Spending by Category
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
            Spending Trends (Last 6 Months)
          </Heading>
          <SpendingTrendsChart months={6} height={300} />
        </Box>
      </Grid>

      {/* Month-over-Month Comparison - Story 5.5 */}
      <Box mb={{ base: 6, md: 8 }}>
        <MonthOverMonth />
      </Box>
    </Box>
  );
}
