'use client';

/**
 * Dashboard Page
 * Story 5.1: Dashboard Layout and Navigation
 *
 * Main dashboard landing page that displays financial overview.
 * This page will be populated with charts and metrics in subsequent stories.
 */

import { Box, Heading, Text, VStack } from '@chakra-ui/react';

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

      {/* Placeholder for dashboard content */}
      <Box
        p={8}
        bg="gray.50"
        borderRadius="lg"
        border="1px"
        borderColor="gray.200"
      >
        <VStack spacing={4}>
          <Heading as="h3" size="md" color="gray.700">
            Dashboard Content Coming Soon
          </Heading>
          <Text fontSize="sm" textAlign="center" color="gray.600">
            Financial summary cards, charts, and insights will be displayed here.
          </Text>
          <Text fontSize="xs" color="gray.500">
            Stories 5.2-5.8 will add dashboard features
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
