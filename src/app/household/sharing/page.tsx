'use client';

import { Card, CardBody, Text, VStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { HouseholdSubPage } from '@/components/household/HouseholdSubPage';
import { TransparencyPresetCard } from '@/components/household/TransparencyPresetCard';

export default function HouseholdSharingPage() {
  const t = useTranslations('householdDashboard');

  return (
    <HouseholdSubPage titleKey="sharingTitle" descriptionKey="sharingSummary">
      <VStack align="stretch" spacing={6}>
        <TransparencyPresetCard />

        {/* Per-category visibility is a property of a CATEGORY and is edited
            where categories are edited. Pointing at it beats duplicating the
            control, which would give one value two places to be set. */}
        <Card>
          <CardBody>
            <Text fontSize="sm" color="fg.muted">
              {t('perCategoryHint')}{' '}
              <Text
                as={NextLink}
                href="/categories"
                color="accent"
                fontWeight="medium"
                textDecoration="underline"
                _focusVisible={{ boxShadow: 'focus', outline: 'none', borderRadius: 'sm' }}
              >
                {t('perCategoryLink')}
              </Text>
            </Text>
          </CardBody>
        </Card>
      </VStack>
    </HouseholdSubPage>
  );
}
