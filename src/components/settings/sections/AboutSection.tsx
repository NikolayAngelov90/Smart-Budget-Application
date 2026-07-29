'use client';

/** About — the financial-advice disclaimer. Story 16.8. */

import { Card, CardBody, Heading, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';

export function AboutSection() {
  const t = useTranslations('disclaimer');

  return (
    <Card>
      <CardBody>
        <VStack align="stretch" spacing={4}>
          <Heading as="h2" size="md" color="fg">
            {t('settingsHeading')}
          </Heading>
          <FinancialDisclaimer variant="full" />
        </VStack>
      </CardBody>
    </Card>
  );
}
