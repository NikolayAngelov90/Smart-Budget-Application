'use client';

/**
 * HouseholdInsightsCard — Story 13.10
 *
 * Household-framed AI spending insights on the household dashboard. Insight text is
 * generated server-side (English, like the other AI engines); only the card chrome is
 * translated. Data is aggregate-only (private excluded server-side).
 */

import { Card, CardBody, VStack, Box, Heading, Text } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHouseholdInsights } from '@/lib/hooks/useHouseholdInsights';

export function HouseholdInsightsCard() {
  const t = useTranslations('householdInsights');
  const { insights, isLoading } = useHouseholdInsights();

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <Heading as="h2" size="md" color="fg">
            {t('heading')}
          </Heading>

          {isLoading ? null : insights.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              {t('none')}
            </Text>
          ) : (
            insights.map((insight, i) => (
              <Box key={`${insight.type}-${insight.metadata.category_id ?? i}`} borderLeftWidth="3px" borderColor="accent" pl={3} py={1}>
                <Text fontSize="sm" fontWeight="semibold" color="fg">
                  {insight.title}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {insight.description}
                </Text>
              </Box>
            ))
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
