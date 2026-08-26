'use client';

/**
 * Household index — Story 17.1.
 *
 * Was one long scroll: three aggregate cards then `HouseholdSection`, which
 * nested create/join, the transparency preset, invitations, member management,
 * the allowance and the contribution split. Read-only views and destructive
 * actions shared a column with no hierarchy, and on mobile member removal was a
 * long way down.
 *
 * Now it is an index, mirroring Settings (Story 16.8): the read-only overview
 * stays here because it is what you come to look at, and everything you come to
 * DO lives one tap away in a named group.
 *
 * The realtime revalidation that used to live here is now in
 * `src/app/household/layout.tsx` via `HouseholdRealtimeProvider`, so it keeps
 * working on whichever sub-page is mounted.
 */

import type { ComponentType } from 'react';
import {
  Card,
  CardBody,
  Container,
  Flex,
  Heading,
  Icon,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ChevronRightIcon, LockIcon, StarIcon, AtSignIcon, CalendarIcon } from '@chakra-ui/icons';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { CombinedSpendingCard } from '@/components/household/CombinedSpendingCard';
import { HouseholdInsightsCard } from '@/components/household/HouseholdInsightsCard';
import { HouseholdSummaryCard } from '@/components/household/HouseholdSummaryCard';
import { HouseholdCreateCard } from '@/components/household/HouseholdCreateCard';

interface HouseholdGroup {
  href: string;
  /** i18n keys (householdDashboard namespace) */
  labelKey: string;
  descriptionKey: string;
  icon: ComponentType;
}

/**
 * Order is deliberate: who is in the household, then what everyone can see of
 * each other, then the money arrangements, then the shared goals. Member
 * removal is destructive and lives inside `/household/members` rather than on
 * this index, the way DangerZoneSection sits apart on the Settings index.
 */
const GROUPS: HouseholdGroup[] = [
  {
    href: '/household/members',
    labelKey: 'membersTitle',
    descriptionKey: 'membersSummary',
    icon: AtSignIcon,
  },
  {
    href: '/household/sharing',
    labelKey: 'sharingTitle',
    descriptionKey: 'sharingSummary',
    icon: LockIcon,
  },
  {
    href: '/household/money',
    labelKey: 'moneyTitle',
    descriptionKey: 'moneySummary',
    icon: CalendarIcon,
  },
  {
    href: '/household/goals',
    labelKey: 'goalsTitle',
    descriptionKey: 'goalsSummary',
    icon: StarIcon,
  },
];

export default function HouseholdPage() {
  const t = useTranslations('householdDashboard');
  const { household, isLoading } = useHousehold();

  return (
    <Container maxW="container.lg" px={{ base: 4, md: 6 }} py={{ base: 4, md: 8 }}>
      <VStack align="stretch" spacing={1} mb={6}>
        <Heading as="h1" size="xl" color="fg" fontFamily="heading" letterSpacing="tight">
          {t('title')}
        </Heading>
        <Text fontSize="sm" color="fg.subtle">
          {t('subtitle')}
        </Text>
      </VStack>

      <VStack align="stretch" spacing={6}>
        {isLoading ? (
          /* NOT the create form. Deriving `inHousehold` as `!isLoading &&
             household` collapses "still loading" into "has no household", so a
             member on a cold load was told "You're not in a household yet"
             before their household had arrived. The old HouseholdSection had
             its own skeleton branch and never did this; the split lost it. */
          <VStack align="stretch" spacing={4}>
            <Skeleton height="72px" borderRadius="md" />
            <Skeleton height="140px" borderRadius="md" />
            <Skeleton height="220px" borderRadius="md" />
          </VStack>
        ) : household ? (
          <>
            <HouseholdSummaryCard />

            {/* Read-only aggregates — what you came to LOOK AT. SharedGoalsCard
                is deliberately NOT here: it creates goals and takes
                contributions, so it is something you come to DO, and it lives
                at /household/goals. Rendering it here as well put "Shared
                goals" on the page twice — once as a card, once as a row linking
                to a duplicate of that card. */}
            <HouseholdInsightsCard />
            <CombinedSpendingCard />

            {/* …and what you came to do. */}
            <Card>
              <CardBody p={0}>
                <VStack align="stretch" spacing={0}>
                  {GROUPS.map((group, index) => (
                    <Flex
                      key={group.href}
                      as={NextLink}
                      href={group.href}
                      align="center"
                      gap={4}
                      px={4}
                      py={3}
                      minH="64px"
                      borderTopWidth={index === 0 ? 0 : '1px'}
                      borderColor="border"
                      _hover={{ bg: 'surface.hover' }}
                      _focusVisible={{
                        outline: '2px solid',
                        outlineColor: 'accent',
                        outlineOffset: '-2px',
                      }}
                    >
                      <Icon as={group.icon} boxSize={5} color="accent" flexShrink={0} />
                      <VStack align="start" spacing={0} flex={1} minW={0}>
                        <Text fontWeight="semibold" color="fg" noOfLines={1}>
                          {t(group.labelKey)}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" noOfLines={1}>
                          {t(group.descriptionKey)}
                        </Text>
                      </VStack>
                      <Icon as={ChevronRightIcon} boxSize={5} color="fg.subtle" flexShrink={0} />
                    </Flex>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          </>
        ) : (
          /* Not in a household: the create form and any pending invite, and
             deliberately NO group rows — they would lead to pages that cannot
             do anything yet. */
          <HouseholdCreateCard />
        )}
      </VStack>
    </Container>
  );
}
