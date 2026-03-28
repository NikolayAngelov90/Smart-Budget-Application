'use client';

/**
 * Goals Page
 * Story 11.5: Savings Goals
 *
 * Dedicated page for managing savings goals.
 * - Lists all goals in a responsive grid
 * - Create/edit goals via modal form
 * - Empty state with CTA when no goals exist
 * - Skeleton loading during data fetch
 */

import {
  Box,
  Button,
  Flex,
  Heading,
  SimpleGrid,
  Skeleton,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';
import { useGoals } from '@/lib/hooks/useGoals';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalForm } from '@/components/goals/GoalForm';
export default function GoalsPage() {
  const t = useTranslations('goals');
  const { goals, isLoading, mutate } = useGoals();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  const { isOpen, onOpen, onClose } = useDisclosure();

  function handleCreateSuccess() {
    onClose();
    void mutate();
  }

  return (
    <AppLayout>
      <Box maxW="1200px" mx="auto" p={{ base: 4, md: 6 }}>
        {/* Page header */}
        <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={3}>
          <Heading as="h1" fontSize={{ base: '1.5rem', lg: '2rem' }} color="gray.700">
            {t('title')}
          </Heading>
          <Button colorScheme="blue" onClick={onOpen}>
            {t('createGoal')}
          </Button>
        </Flex>

        {/* Loading skeletons */}
        {isLoading && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height="180px" borderRadius="md" data-testid="goal-skeleton" />
            ))}
          </SimpleGrid>
        )}

        {/* Empty state */}
        {!isLoading && goals.length === 0 && (
          <VStack py={16} spacing={4} align="center">
            <Text color="gray.500" fontSize="lg" fontWeight="medium">
              {t('emptyState')}
            </Text>
            <Text color="gray.400" fontSize="sm">
              {t('emptyStateSubtitle')}
            </Text>
            <Button colorScheme="blue" onClick={onOpen}>
              {t('createGoal')}
            </Button>
          </VStack>
        )}

        {/* Goals grid */}
        {!isLoading && goals.length > 0 && (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                currency={currency}
                onMutate={() => void mutate()}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* Create goal modal */}
      <GoalForm
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleCreateSuccess}
      />
    </AppLayout>
  );
}
