'use client';

/**
 * SharedGoalsCard — Story 13.8
 *
 * Shared household goal status. Story 13.9 (Shared Household Savings Goals) builds the
 * underlying data; until then this renders a forward-compatible empty state. When 13.9
 * lands, fetch the shared goals here and render the list/progress in place of the empty state.
 */

import { Card, CardBody, VStack, Heading, Text } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

export function SharedGoalsCard() {
  const t = useTranslations('householdDashboard');

  // Story 13.9 seam: replace this empty state with the shared-goals list once available.
  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <Heading as="h2" size="md" color="gray.700">
            {t('sharedGoals')}
          </Heading>
          <Text fontSize="sm" color="gray.600">
            {t('noSharedGoals')}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
}
