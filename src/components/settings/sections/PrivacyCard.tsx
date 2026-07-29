'use client';

/** Privacy notice. The delete-account action moved to its own Danger row. */

import { Alert, AlertIcon, Card, CardBody } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

export function PrivacyCard() {
  const t = useTranslations('settings');
  return (
    <Card>
      <CardBody>
        <Alert status="info" variant="left-accent">
          <AlertIcon />
          {t('bankLevelEncryption')}
        </Alert>
      </CardBody>
    </Card>
  );
}
