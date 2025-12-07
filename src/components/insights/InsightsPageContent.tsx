'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Heading, Text, VStack, HStack, useToast } from '@chakra-ui/react';
import useSWR from 'swr';
import { InsightsFilters } from './InsightsFilters';
import { InsightsList } from './InsightsList';
import { EmptyInsightsState } from './EmptyInsightsState';
import { RefreshInsightsButton } from './RefreshInsightsButton';
import type { Insight } from '@/types/database.types';

// Fetcher for SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch insights');
  }
  const data = await res.json();
  return data.insights || [];
};

export function InsightsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Extract filters from URL
  const filters = useMemo(() => ({
    type: searchParams.get('type') || 'all',
    dismissed: searchParams.get('dismissed') === 'true',
    search: searchParams.get('search') || '',
  }), [searchParams]);

  // Build query string for API
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.type !== 'all') {
      params.append('type', filters.type);
    }

    params.append('dismissed', filters.dismissed.toString());

    if (filters.search) {
      params.append('search', filters.search);
    }

    return params.toString();
  }, [filters]);

  // Fetch insights with SWR
  const { data: insights, error, isLoading, mutate } = useSWR<Insight[]>(
    `/api/insights?${queryString}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
      dedupingInterval: 60000, // 1 minute
      revalidateOnFocus: true,
    }
  );

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    const params = new URLSearchParams();

    if (updatedFilters.type !== 'all') {
      params.append('type', updatedFilters.type);
    }

    if (updatedFilters.dismissed) {
      params.append('dismissed', 'true');
    }

    if (updatedFilters.search) {
      params.append('search', updatedFilters.search);
    }

    const newUrl = params.toString() ? `/insights?${params.toString()}` : '/insights';
    router.push(newUrl);
  };

  // Handle dismiss insight
  const handleDismiss = async (id: string) => {
    if (!insights) return;

    // Optimistic update
    const optimisticInsights = insights.map(insight =>
      insight.id === id ? { ...insight, is_dismissed: true } : insight
    );
    mutate(optimisticInsights, false);

    try {
      const res = await fetch(`/api/insights/${id}/dismiss`, {
        method: 'PUT',
      });

      if (!res.ok) {
        throw new Error('Failed to dismiss insight');
      }

      // Revalidate
      await mutate();

      toast({
        title: 'Insight dismissed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Revert on error
      mutate();

      toast({
        title: 'Failed to dismiss insight',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle undismiss insight
  const handleUndismiss = async (id: string) => {
    if (!insights) return;

    // Optimistic update
    const optimisticInsights = insights.map(insight =>
      insight.id === id ? { ...insight, is_dismissed: false } : insight
    );
    mutate(optimisticInsights, false);

    try {
      const res = await fetch(`/api/insights/${id}/undismiss`, {
        method: 'PUT',
      });

      if (!res.ok) {
        throw new Error('Failed to restore insight');
      }

      // Revalidate
      await mutate();

      toast({
        title: 'Insight restored',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Revert on error
      mutate();

      toast({
        title: 'Failed to restore insight',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Determine if there are active filters
  const hasActiveFilters = filters.type !== 'all' || filters.search !== '';

  // Determine empty state message
  const getEmptyMessage = () => {
    if (hasActiveFilters) {
      return 'No insights match your filters';
    }
    return 'No insights available yet. Check back soon for personalized budget recommendations!';
  };

  return (
    <Box maxW="1200px" mx="auto" p={{ base: 4, md: 6 }}>
      <VStack align="start" spacing={6} w="full">
        {/* Header with Refresh Button */}
        <Box w="full">
          <HStack
            justify="space-between"
            align={{ base: 'start', md: 'center' }}
            flexDirection={{ base: 'column', md: 'row' }}
            spacing={{ base: 3, md: 4 }}
            w="full"
          >
            <Box flex="1">
              <Heading as="h1" size={{ base: 'xl', md: '2xl' }} mb={2}>
                AI Budget Insights
              </Heading>
              <Text color="gray.600" fontSize={{ base: 'md', md: 'lg' }}>
                View and manage all your personalized budget recommendations
              </Text>
            </Box>
            {/* Refresh Button - positioned right on desktop, full-width on mobile */}
            <Box w={{ base: 'full', md: 'auto' }}>
              <RefreshInsightsButton size="md" variant="solid" />
            </Box>
          </HStack>
        </Box>

        {/* Filters */}
        <InsightsFilters
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        {/* Error State */}
        {error && (
          <EmptyInsightsState
            message="Failed to load insights. Please try again later."
            hasFilters={false}
          />
        )}

        {/* Insights List or Empty State */}
        {!error && (
          <>
            {!isLoading && insights && insights.length === 0 ? (
              <EmptyInsightsState
                message={getEmptyMessage()}
                hasFilters={hasActiveFilters}
              />
            ) : (
              <InsightsList
                insights={insights || []}
                onDismiss={handleDismiss}
                onUndismiss={handleUndismiss}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </VStack>
    </Box>
  );
}
