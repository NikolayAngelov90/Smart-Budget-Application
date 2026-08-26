'use client';

import { HouseholdSubPage } from '@/components/household/HouseholdSubPage';
import { SharedGoalsCard } from '@/components/household/SharedGoalsCard';

export default function HouseholdGoalsPage() {
  return (
    <HouseholdSubPage titleKey="goalsTitle" descriptionKey="goalsSummary">
      <SharedGoalsCard />
    </HouseholdSubPage>
  );
}
