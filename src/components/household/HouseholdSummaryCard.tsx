'use client';

/**
 * Which household you are in, and your role — extracted in Story 17.1.
 *
 * Was the header row of `HouseholdSection`. It stays on the index because it
 * identifies the thing the sub-pages are about; repeating it on each sub-page
 * would be noise, and the sub-page title already says where you are.
 */

import { Badge, Card, CardBody, HStack, Text, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';

export function HouseholdSummaryCard() {
  const t = useTranslations('household');
  const { household } = useHousehold();

  if (!household) return null;

  return (
    <Card>
      <CardBody>
        <HStack justify="space-between" align="center">
          <VStack align="flex-start" spacing={0}>
            <Text fontWeight="semibold" color="fg">
              {household.name}
            </Text>
            <Text fontSize="sm" color="fg.subtle">
              {t('memberSince')}
            </Text>
          </VStack>
          <Badge
            {...(household.role === 'admin'
              ? { colorScheme: 'income' }
              : { colorScheme: 'paper' })}
            borderRadius="full"
            px={3}
            py={1}
          >
            {household.role === 'admin' ? t('roleAdmin') : t('roleMember')}
          </Badge>
        </HStack>
      </CardBody>
    </Card>
  );
}
