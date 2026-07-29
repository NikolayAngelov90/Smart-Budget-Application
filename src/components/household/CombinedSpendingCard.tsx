'use client';

/**
 * CombinedSpendingCard — Story 13.8
 *
 * Combined household spending per shared category (the shared pot). Data comes from the
 * membership-gated household_category_totals RPC (Story 13.4) — aggregates only, private
 * categories already excluded server-side. category_only rows are tagged "total only".
 */

import { Box, Card, CardBody, VStack, HStack, Heading, Text, Progress, Badge } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHouseholdCategoryTotals } from '@/lib/hooks/useHouseholdCategoryTotals';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';

export function CombinedSpendingCard() {
  const t = useTranslations('householdDashboard');
  const { totals, isLoading } = useHouseholdCategoryTotals();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format || 'EUR';

  const max = totals.reduce((m, c) => Math.max(m, Number(c.total)), 0);

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <Box>
            <Heading as="h2" size="md" color="fg">
              {t('combinedSpending')}
            </Heading>
            <Text fontSize="xs" color="fg.subtle">
              {t('thisMonth')}
            </Text>
          </Box>

          {isLoading ? null : totals.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              {t('noSharedCategories')}
            </Text>
          ) : (
            totals.map((c) => (
              <VStack key={c.category_id} align="stretch" spacing={1}>
                <HStack justify="space-between">
                  <HStack spacing={2}>
                    <Text fontSize="sm" color="fg">
                      {c.category_name}
                    </Text>
                    {c.visibility_level === 'category_only' && (
                      <Badge bg="surface.sunken" color="fg.muted" fontSize="10px">
                        {t('totalOnly')}
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="sm" fontWeight="semibold" color="fg">
                    {formatAmount(Number(c.total), currency)}
                  </Text>
                </HStack>
                <Progress
                  value={max > 0 ? (Number(c.total) / max) * 100 : 0}
                  size="xs"
                  borderRadius="full"
                  colorScheme="brand"
                />
              </VStack>
            ))
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
