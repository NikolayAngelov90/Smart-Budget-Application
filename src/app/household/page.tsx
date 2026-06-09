'use client';

/**
 * Household Dashboard Page — Story 13.8
 *
 * Shared view of household financial health: combined spending by shared category,
 * each member's contribution progress, and shared goal status. Membership-gated; updates
 * in near-real-time when another member changes a transaction.
 *
 * Transparency is enforced server-side by the membership-gated RPCs (private excluded,
 * category_only = totals only) — this page only renders what those endpoints return.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Box, Heading, Text, VStack, Grid, Button, Card, CardBody } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { mutate as globalMutate } from 'swr';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { CombinedSpendingCard } from '@/components/household/CombinedSpendingCard';
import { ContributionProgressCard } from '@/components/household/ContributionProgressCard';
import { SharedGoalsCard } from '@/components/household/SharedGoalsCard';
import { HouseholdInsightsCard } from '@/components/household/HouseholdInsightsCard';

export default function HouseholdDashboardPage() {
  const t = useTranslations('householdDashboard');
  const { household, isLoading } = useHousehold();

  // AC#5: when another member changes a transaction, revalidate the dashboard aggregates.
  // Trailing guard so a burst of inserts collapses into a single refresh; SWR also dedupes.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revalidate = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      globalMutate('/api/households/category-totals');
      globalMutate('/api/households/contributions');
      globalMutate('/api/households/goals'); // a contribution also logs a transaction → keep goals fresh
      globalMutate('/api/households/insights'); // shared spend changed → recompute insights
    }, 150);
  }, []);
  useRealtimeSubscription(revalidate);

  // Don't let a queued revalidation fire after the page unmounts.
  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);

  return (
    <Box maxW="container.lg" mx="auto" px={{ base: 4, md: 6 }} py={6}>
      <VStack align="stretch" spacing={1} mb={6}>
        <Heading as="h1" size="lg" color="gray.800">
          {t('title')}
        </Heading>
        <Text fontSize="sm" color="gray.500">
          {t('subtitle')}
        </Text>
      </VStack>

      {isLoading ? null : !household ? (
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={3}>
              <Text fontSize="sm" color="gray.600">
                {t('noHousehold')}
              </Text>
              <Button as={NextLink} href="/settings" colorScheme="blue" alignSelf="flex-start" size="sm">
                {t('noHouseholdCta')}
              </Button>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
          <Box gridColumn={{ lg: '1 / -1' }}>
            <HouseholdInsightsCard />
          </Box>
          <CombinedSpendingCard />
          <ContributionProgressCard />
          <Box gridColumn={{ lg: '1 / -1' }}>
            <SharedGoalsCard />
          </Box>
        </Grid>
      )}
    </Box>
  );
}
