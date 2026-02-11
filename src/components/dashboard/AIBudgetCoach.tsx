'use client';

import {
  Box,
  Heading,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Card,
  CardBody,
  VStack,
  Text,
  Link as ChakraLink,
  Icon,
  Flex,
} from '@chakra-ui/react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { InfoIcon } from '@chakra-ui/icons';
import { AIInsightCard } from '@/components/insights/AIInsightCard';
import type { Insight } from '@/types/database.types';

interface InsightsResponse {
  insights: Insight[];
  total: number;
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<InsightsResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch insights');
  }
  return res.json();
};

export function AIBudgetCoach() {
  const t = useTranslations('insights');
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<InsightsResponse>(
    '/api/insights?limit=3&dismissed=false&orderBy=priority',
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
      revalidateOnFocus: true,
      dedupingInterval: 60000, // 1 minute
    }
  );

  // Handle dismiss action
  const handleDismiss = async (insightId: string) => {
    try {
      // Optimistically update the cache
      if (data) {
        mutate(
          {
            ...data,
            insights: data.insights.filter((insight) => insight.id !== insightId),
            total: data.total - 1,
          },
          false
        );
      }

      // Make API call to dismiss
      const res = await fetch(`/api/insights/${insightId}/dismiss`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_dismissed: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to dismiss insight');
      }

      // Revalidate to get fresh data
      mutate();
    } catch (error) {
      console.error('Error dismissing insight:', error);
      // Revert optimistic update on error
      mutate();
    }
  };

  return (
    <Box w="full" mb={{ base: 6, md: 8 }}>
      {/* Section Heading */}
      <Heading
        as="h2"
        size={{ base: 'lg', md: 'xl' }}
        mb={4}
        color="gray.800"
      >
        {t('aiBudgetCoach')}
      </Heading>

      {/* Loading State */}
      {isLoading && (
        <SimpleGrid
          columns={{ base: 1, md: 2, lg: 3 }}
          spacing={{ base: 4, md: 6 }}
        >
          {[1, 2, 3].map((i) => (
            <Card key={i} minH="120px">
              <CardBody>
                <Skeleton height="20px" mb={3} />
                <SkeletonText noOfLines={3} spacing={2} />
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Error State */}
      {error && (
        <Card borderLeft="4px" borderColor="red.500">
          <CardBody>
            <Text color="red.600">
              {t('unableToLoad')}
            </Text>
          </CardBody>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && data && data.insights.length === 0 && (
        <Card borderLeft="4px" borderColor="blue.500">
          <CardBody>
            <VStack spacing={3} align="start">
              <Flex align="center" gap={2}>
                <Icon as={InfoIcon} color="blue.500" boxSize={5} />
                <Heading size="md" color="gray.800">
                  {t('keepTracking')}
                </Heading>
              </Flex>
              <Text color="gray.600">
                {t('keepTrackingDescription')}
              </Text>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Insights Display */}
      {!isLoading && !error && data && data.insights.length > 0 && (
        <>
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3 }}
            spacing={{ base: 4, md: 6 }}
          >
            {data.insights.map((insight) => (
              <AIInsightCard
                key={insight.id}
                insight={insight}
                onDismiss={handleDismiss}
              />
            ))}
          </SimpleGrid>

          {/* View All Link */}
          {data.total > 3 && (
            <Flex justifyContent="flex-end" mt={4}>
              <ChakraLink
                as={Link}
                href="/insights"
                color="blue.500"
                fontWeight="medium"
                fontSize={{ base: 'sm', md: 'md' }}
                _hover={{
                  color: 'blue.600',
                  textDecoration: 'underline',
                }}
              >
                {t('seeAllInsights', { count: data.total })}
              </ChakraLink>
            </Flex>
          )}
        </>
      )}
    </Box>
  );
}
