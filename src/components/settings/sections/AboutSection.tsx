'use client';

/** About — the financial-advice disclaimer. Story 16.8. */

import { Card, CardBody } from '@chakra-ui/react';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';

export function AboutSection() {
  return (
    <Card>
      <CardBody>
        <FinancialDisclaimer variant="full" />
      </CardBody>
    </Card>
  );
}
