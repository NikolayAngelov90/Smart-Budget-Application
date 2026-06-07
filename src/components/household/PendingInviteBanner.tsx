'use client';

/**
 * PendingInviteBanner — Story 13.2 follow-up (in-app invite delivery)
 *
 * Shows the authenticated user any pending household invitation addressed to them, with an
 * Accept button — so they no longer depend on the admin manually sharing the link. Rendered
 * in HouseholdSection's empty state (a user with a household can't accept another).
 */

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, useToast } from '@chakra-ui/react';
import { mutate as globalMutate } from 'swr';
import { useTranslations } from 'next-intl';
import { useMyInvitations } from '@/lib/hooks/useMyInvitations';

export function PendingInviteBanner() {
  const t = useTranslations('invitations');
  const toast = useToast();
  const { invitations, isLoading, mutate } = useMyInvitations();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  if (isLoading || invitations.length === 0) return null;

  const handleAccept = async (id: string, token: string) => {
    setAcceptingId(id);
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error(t('acceptFailed'));
      await mutate();
      await globalMutate('/api/households'); // the user now belongs to a household
      toast({ title: t('joinedSuccess'), status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('acceptFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <VStack align="stretch" spacing={2}>
      {invitations.map((inv) => (
        <Box key={inv.id} borderWidth="1px" borderColor="blue.200" bg="blue.50" borderRadius="md" p={3}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
            <Text fontSize="sm" color="gray.800">
              {t('invitedToJoin', { household: inv.householdName })}
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={() => handleAccept(inv.id, inv.token)}
              isLoading={acceptingId === inv.id}
              loadingText={t('joining')}
              flexShrink={0}
            >
              {t('acceptCta')}
            </Button>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
}
