'use client';

/**
 * Household Page — Epic 13 hub (Stories 13.1–13.11)
 *
 * The single home for everything household: shared spending, contribution split, shared
 * goals, household AI insights, the personal allowance, transparency preset, invitations,
 * and member management. Membership-gated; updates in near-real-time when another member
 * changes a transaction. Transparency is enforced server-side by the membership-gated RPCs.
 *
 * (Management used to live in Settings; it now lives here so the whole feature is reachable
 * from the Household nav tab.)
 */

import { useCallback, useEffect, useRef } from 'react';
import { Box, Heading, Text, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { mutate as globalMutate } from 'swr';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { CombinedSpendingCard } from '@/components/household/CombinedSpendingCard';
import { SharedGoalsCard } from '@/components/household/SharedGoalsCard';
import { HouseholdInsightsCard } from '@/components/household/HouseholdInsightsCard';
import { HouseholdSection } from '@/components/household/HouseholdSection';

export default function HouseholdPage() {
  const t = useTranslations('householdDashboard');
  const { household, isLoading } = useHousehold();

  // When another member changes a transaction, revalidate the household aggregates.
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

      <VStack align="stretch" spacing={6}>
        {/* Member-only shared views (read-only aggregates). Hidden until you're in a household. */}
        {!isLoading && household && (
          <>
            <HouseholdInsightsCard />
            <CombinedSpendingCard />
            <SharedGoalsCard />
          </>
        )}

        {/* Management hub: create/join, invitations, members, transparency preset, personal
            allowance, and the contribution split editor. Renders the create form + pending
            invite banner when you're not yet in a household. */}
        <HouseholdSection />
      </VStack>
    </Box>
  );
}
