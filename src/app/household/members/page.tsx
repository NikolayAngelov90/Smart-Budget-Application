'use client';

import { VStack } from '@chakra-ui/react';
import { HouseholdSubPage } from '@/components/household/HouseholdSubPage';
import { HouseholdInvites } from '@/components/household/HouseholdInvites';
import { HouseholdMembers } from '@/components/household/HouseholdMembers';
import { useHousehold } from '@/lib/hooks/useHousehold';

export default function HouseholdMembersPage() {
  const { household } = useHousehold();
  const isAdmin = household?.role === 'admin';

  return (
    <HouseholdSubPage titleKey="membersTitle" descriptionKey="membersSummary">
      <VStack align="stretch" spacing={6}>
        {isAdmin && <HouseholdInvites />}
        <HouseholdMembers isAdmin={isAdmin} />
      </VStack>
    </HouseholdSubPage>
  );
}
