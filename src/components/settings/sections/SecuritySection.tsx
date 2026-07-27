'use client';

/** Security — active devices/sessions + the privacy notice. Story 16.8. */

import { VStack } from '@chakra-ui/react';
import { ActiveDevicesSection } from '@/components/settings/ActiveDevicesSection';
import { PrivacyCard } from '@/components/settings/sections/PrivacyCard';

export function SecuritySection() {
  return (
    <VStack spacing={6} align="stretch">
      <ActiveDevicesSection />
      <PrivacyCard />
    </VStack>
  );
}
