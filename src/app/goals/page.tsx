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

import { useCallback, useEffect } from 'react';
import {
  Button,
  Container,
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
import { WishlistSection } from '@/components/goals/WishlistSection';
import { WhatIfSimulator } from '@/components/goals/WhatIfSimulator';
export default function GoalsPage() {
  const t = useTranslations('goals');
  const { goals, isLoading, mutate } = useGoals();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';

  const { isOpen, onOpen, onClose } = useDisclosure();

  // Mobile "More" sheet deep-link: `/goals?new=1` (the sheet's inline "+") opens
  // the create form on arrival, then strips the param so a refresh won't reopen it.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      onOpen();
      window.history.replaceState(null, '', '/goals');
    }
  }, [onOpen]);

  // M4: stable identity prevents GoalCard's milestone useEffect from re-running on every parent render
  const handleMutate = useCallback(() => void mutate(), [mutate]);

  function handleCreateSuccess() {
    onClose();
    void mutate();
  }

  return (
    <AppLayout>
      <Container maxW="container.xl" px={{ base: 4, md: 6 }} py={{ base: 4, md: 8 }}>
        {/* Page header */}
        <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={3}>
          <Heading as="h1" size="xl" color="fg" fontFamily="heading" letterSpacing="tight">
            {t('title')}
          </Heading>
          <Button colorScheme="brand" onClick={onOpen}>
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
            <Text color="fg.subtle" fontSize="lg" fontWeight="medium">
              {t('emptyState')}
            </Text>
            <Text color="fg.subtle" fontSize="sm">
              {t('emptyStateSubtitle')}
            </Text>
            <Button colorScheme="brand" onClick={onOpen}>
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
                onMutate={handleMutate}
              />
            ))}
          </SimpleGrid>
        )}

        {/* Wishlist with budget impact — Story 14.3 (FR15) */}
        <WishlistSection />

        {/* "What If" savings simulator — Story 14.4 (FR16, exploratory only) */}
        <WhatIfSimulator />
      </Container>

      {/* Create goal modal */}
      <GoalForm
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleCreateSuccess}
      />
    </AppLayout>
  );
}
