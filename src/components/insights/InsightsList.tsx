'use client';

import { VStack, Text, Spinner, Center, Box, SimpleGrid } from '@chakra-ui/react';
import { format } from 'date-fns';
import { AIInsightCard } from './AIInsightCard';
import type { Insight } from '@/types/database.types';

interface InsightsListProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onUndismiss: (id: string) => void;
  isLoading?: boolean;
}

export function InsightsList({
  insights,
  onDismiss,
  onUndismiss,
  isLoading = false,
}: InsightsListProps) {
  if (isLoading) {
    return (
      <Center w="full" py={12}>
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.600">Loading insights...</Text>
        </VStack>
      </Center>
    );
  }

  if (insights.length === 0) {
    return null; // Empty state handled by parent component
  }

  return (
    <Box w="full">
      <SimpleGrid columns={{ base: 1, lg: 1 }} spacing={4} w="full">
        {insights.map((insight) => (
          <Box key={insight.id} position="relative">
            {/* Date badge */}
            <Text
              fontSize="sm"
              color="gray.500"
              mb={2}
              fontWeight="medium"
            >
              {format(new Date(insight.created_at), 'PPP')} • {format(new Date(insight.created_at), 'p')}
            </Text>

            <AIInsightCard
              insight={insight}
              onDismiss={onDismiss}
              onUndismiss={onUndismiss}
              isDismissed={insight.is_dismissed}
            />
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
