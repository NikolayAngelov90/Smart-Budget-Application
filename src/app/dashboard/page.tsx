'use client';

/**
 * Dashboard Page
 * Story 5.1: Dashboard Layout and Navigation
 * Story 5.2: Financial Summary Cards
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 *
 * Main dashboard landing page that displays financial overview.
 * This page will be populated with charts and metrics in subsequent stories.
 */

import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { CategorySpendingChart } from '@/components/dashboard/CategorySpendingChart';
import { SpendingTrendsChart } from '@/components/dashboard/SpendingTrendsChart';

export default function DashboardPage() {
  return (
    <Box>
      <VStack align="start" spacing={6} mb={8}>
        <Heading as="h1" size="xl" color="gray.800">
          Dashboard
        </Heading>
        <Text fontSize="lg" color="gray.600">
          Your financial overview
        </Text>
      </VStack>

      {/* Financial Summary Cards - Story 5.2 */}
      <Box mb={8}>
        <DashboardStats />
      </Box>

      {/* Category Spending Chart - Story 5.3 */}
      <Box mb={8}>
        <Heading as="h2" size="md" mb={4} color="gray.700">
          Spending by Category
        </Heading>
        <CategorySpendingChart chartType="donut" height={300} />
      </Box>

      {/* Spending Trends Chart - Story 5.4 */}
      <Box mb={8}>
        <Heading as="h2" size="md" mb={4} color="gray.700">
          Spending Trends (Last 6 Months)
        </Heading>
        <SpendingTrendsChart months={6} height={300} />
      </Box>

      {/* Placeholder for additional dashboard content */}
      <Box
        p={8}
        bg="gray.50"
        borderRadius="lg"
        border="1px"
        borderColor="gray.200"
      >
        <VStack spacing={4}>
          <Heading as="h3" size="md" color="gray.700">
            Additional Dashboard Content Coming Soon
          </Heading>
          <Text fontSize="sm" textAlign="center" color="gray.600">
            More charts and insights will be displayed here.
          </Text>
          <Text fontSize="xs" color="gray.500">
            Stories 5.5-5.8 will add more dashboard features
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
