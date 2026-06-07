'use client';

/**
 * ContributionProgressCard — Story 13.8
 *
 * Read-only view of each member's contribution progress (fair share vs contributed) from
 * Story 13.7's household_contributions aggregate. The percentage editor stays in Settings;
 * this is the dashboard summary only.
 */

import { Card, CardBody, VStack, HStack, Heading, Text, Progress, Badge } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useContributions } from '@/lib/hooks/useContributions';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';

export function ContributionProgressCard() {
  const t = useTranslations('householdDashboard');
  const { summary, isLoading } = useContributions();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format || 'EUR';

  const splits = summary?.splits ?? [];

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <Heading as="h2" size="md" color="gray.700">
            {t('contributionProgress')}
          </Heading>

          {isLoading ? null : splits.length === 0 ? (
            <Text fontSize="sm" color="gray.600">
              {t('noContributions')}
            </Text>
          ) : (
            splits.map((s) => {
              const pct = Math.min(100, Math.round(s.progress * 100));
              return (
                <VStack key={s.user_id} align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <Text fontSize="sm" color="gray.800">
                        {s.isSelf ? t('you') : s.email}
                      </Text>
                      {s.percentage != null && (
                        <Badge colorScheme="blue" borderRadius="full" px={2}>
                          {s.percentage}%
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {formatAmount(s.contributed, currency)} / {formatAmount(s.fairShare, currency)}
                    </Text>
                  </HStack>
                  <Progress
                    value={pct}
                    size="xs"
                    borderRadius="full"
                    colorScheme={s.progress >= 1 ? 'green' : 'blue'}
                  />
                </VStack>
              );
            })
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
