'use client';

import { VStack } from '@chakra-ui/react';
import { HouseholdSubPage } from '@/components/household/HouseholdSubPage';
import { AllowanceCard } from '@/components/household/AllowanceCard';
import { ContributionSplitCard } from '@/components/household/ContributionSplitCard';

export default function HouseholdMoneyPage() {
  return (
    <HouseholdSubPage titleKey="moneyTitle" descriptionKey="moneySummary">
      <VStack align="stretch" spacing={6}>
        {/* Story 13.6: private personal allowance (owner-only) */}
        <AllowanceCard />
        {/* Story 13.7: income-proportional contribution splits */}
        <ContributionSplitCard />
      </VStack>
    </HouseholdSubPage>
  );
}
