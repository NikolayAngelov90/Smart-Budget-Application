'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Box, Heading, Text, VStack, HStack, useToast, Button } from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { InsightsFilters } from './InsightsFilters';
import { InsightsList } from './InsightsList';
import { EmptyInsightsState } from './EmptyInsightsState';
import { RefreshInsightsButton } from './RefreshInsightsButton';
import { InsightsPagination } from './InsightsPagination';
import { trackInsightsPageViewed, trackInsightDismissed } from '@/lib/services/analyticsService';
import type { Insight } from '@/types/database.types';

// API response type
interface InsightsResponse {
  insights: Insight[];
  total: number;
}

// Fetcher for SWR
const fetcher = async (url: string): Promise<InsightsResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch insights');
  }
  const data = await res.json();
  return {
    insights: data.insights || [],
    total: data.total || 0,
  };
};

export function InsightsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const t = useTranslations('insights');
  const tCommon = useTranslations('common');

  // Extract filters from URL
  const filters = useMemo(() => ({
    type: searchParams.get('type') || 'all',
    dismissed: searchParams.get('dismissed') === 'true',
    search: searchParams.get('search') || '',
    page: parseInt(searchParams.get('page') || '1', 10),
  }), [searchParams]);

  // Pagination configuration
  const INSIGHTS_PER_PAGE = 20;

  // Build query string for API
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    // Pagination params
    params.append('limit', INSIGHTS_PER_PAGE.toString());
    params.append('offset', ((filters.page - 1) * INSIGHTS_PER_PAGE).toString());

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
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(
    `/api/insights?${queryString}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
      dedupingInterval: 60000, // 1 minute
      revalidateOnFocus: true,
    }
  );

  const insights = data?.insights || [];
  const totalInsights = data?.total || 0;

  // Track page view once on mount (AC-9.4.3)
  const hasTrackedPageView = useRef(false);
  useEffect(() => {
    if (!hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackInsightsPageViewed(filters.type, filters.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - track once on mount, not on filter changes

  // Handle filter changes (reset to page 1 when filters change)
  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    const params = new URLSearchParams();

    // Always include type in URL to ensure proper state tracking
    params.append('type', updatedFilters.type);

    if (updatedFilters.dismissed) {
      params.append('dismissed', 'true');
    }

    if (updatedFilters.search) {
      params.append('search', updatedFilters.search);
    }

    if (updatedFilters.page > 1) {
      params.append('page', updatedFilters.page.toString());
    }

    const newUrl = `/insights?${params.toString()}`;
    router.replace(newUrl); // Use replace instead of push to avoid navigation history bloat
  };

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    const updatedFilters = { ...filters, page: newPage };
    const params = new URLSearchParams();

    // Always include type in URL to ensure proper state tracking
    params.append('type', updatedFilters.type);

    if (updatedFilters.dismissed) {
      params.append('dismissed', 'true');
    }

    if (updatedFilters.search) {
      params.append('search', updatedFilters.search);
    }

    if (updatedFilters.page > 1) {
      params.append('page', updatedFilters.page.toString());
    }

    const newUrl = `/insights?${params.toString()}`;
    router.replace(newUrl); // Use replace instead of push
  };

  // Handle dismiss insight
  const handleDismiss = async (id: string) => {
    if (!data) return;

    // Find the insight to get its type for analytics
    const insight = data.insights.find(i => i.id === id);

    // Optimistic update
    const optimisticData: InsightsResponse = {
      insights: data.insights.map(i =>
        i.id === id ? { ...i, is_dismissed: true } : i
      ),
      total: data.total,
    };
    mutate(optimisticData, false);

    try {
      const res = await fetch(`/api/insights/${id}/dismiss`, {
        method: 'PUT',
      });

      if (!res.ok) {
        throw new Error('Failed to dismiss insight');
      }

      // Track dismissal event (AC-9.4.5)
      if (insight) {
        trackInsightDismissed(id, insight.type);
      }

      // Revalidate
      await mutate();

      toast({
        title: t('dismissed'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Revert on error
      mutate();

      toast({
        title: t('failedToDismiss'),
        description: error instanceof Error ? error.message : tCommon('unknownError'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle undismiss insight
  const handleUndismiss = async (id: string) => {
    if (!data) return;

    // Optimistic update
    const optimisticData: InsightsResponse = {
      insights: data.insights.map(insight =>
        insight.id === id ? { ...insight, is_dismissed: false } : insight
      ),
      total: data.total,
    };
    mutate(optimisticData, false);

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
        title: t('restored'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Revert on error
      mutate();

      toast({
        title: t('failedToRestore'),
        description: error instanceof Error ? error.message : tCommon('unknownError'),
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
      return t('noMatchingInsights');
    }
    return t('noInsightsYet');
  };

  return (
    <Box maxW="1200px" mx="auto" p={{ base: 4, md: 6 }}>
      <VStack align="start" spacing={6} w="full">
        {/* Back to Dashboard Button */}
        <Box>
          <Button
            as={Link}
            href="/dashboard"
            leftIcon={<ChevronLeftIcon />}
            variant="ghost"
            colorScheme="blue"
            size="sm"
            _hover={{ bg: 'blue.50' }}
          >
            {t('backToDashboard')}
          </Button>
        </Box>

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
                {t('pageTitle')}
              </Heading>
              <Text color="gray.600" fontSize={{ base: 'md', md: 'lg' }}>
                {t('pageSubtitle')}
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
            message={t('failedToLoad')}
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
              <>
                <InsightsList
                  insights={insights || []}
                  onDismiss={handleDismiss}
                  onUndismiss={handleUndismiss}
                  isLoading={isLoading}
                />
                {/* Pagination Controls */}
                <InsightsPagination
                  currentPage={filters.page}
                  totalInsights={totalInsights}
                  insightsPerPage={INSIGHTS_PER_PAGE}
                  onPageChange={handlePageChange}
                  isLoading={isLoading}
                />
              </>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
}
