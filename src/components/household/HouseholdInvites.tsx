'use client';

/**
 * HouseholdInvites — Story 13.2
 *
 * Admin-only: invite members by email, and manage pending invitations
 * (copy the shareable accept link, revoke). Rendered inside HouseholdSection
 * only when the current user is the household admin.
 */

import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  IconButton,
  Badge,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { CopyIcon, CloseIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { useInvitations } from '@/lib/hooks/useInvitations';

export function HouseholdInvites() {
  const t = useTranslations('invitations');
  const toast = useToast();
  const { invitations, mutate } = useInvitations();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pending = invitations.filter((inv) => inv.status === 'pending');

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!response.ok) {
        throw new Error(response.status === 409 ? t('alreadyInvited') : t('inviteFailed'));
      }
      setEmail('');
      await mutate();
      toast({ title: t('invited'), status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('inviteFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const response = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('revokeFailed'));
      await mutate();
      toast({ title: t('revoked'), status: 'success', duration: 2500, isClosable: true });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('revokeFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleCopy = async (link: string | undefined) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: t('linkCopied'), status: 'success', duration: 2000, isClosable: true });
    } catch {
      toast({ title: t('copyFailed'), status: 'error', duration: 3000, isClosable: true });
    }
  };

  return (
    <Box>
      <Divider my={2} />
      <Heading as="h3" size="sm" color="gray.700" mb={2}>
        {t('heading')}
      </Heading>

      <HStack mb={pending.length > 0 ? 4 : 0}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          maxLength={254}
          aria-label={t('emailPlaceholder')}
        />
        <Button
          colorScheme="blue"
          onClick={handleInvite}
          isLoading={isSubmitting}
          loadingText={t('sending')}
          isDisabled={!email.trim()}
          flexShrink={0}
        >
          {t('send')}
        </Button>
      </HStack>

      {pending.length > 0 && (
        <VStack align="stretch" spacing={2}>
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="semibold">
            {t('pendingTitle')}
          </Text>
          {pending.map((inv) => (
            <HStack key={inv.id} justify="space-between" align="center" py={1}>
              <VStack align="flex-start" spacing={0} flex={1} minW={0}>
                <Text fontSize="sm" color="gray.800" isTruncated maxW="full">
                  {inv.email}
                </Text>
                {inv.isExpired ? (
                  <Badge colorScheme="gray" fontSize="10px">
                    {t('expired')}
                  </Badge>
                ) : (
                  <Text fontSize="xs" color="gray.500">
                    {t('expires')}
                  </Text>
                )}
              </VStack>
              <HStack spacing={1} flexShrink={0}>
                <IconButton
                  aria-label={t('copyLink')}
                  icon={<CopyIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(inv.acceptLink)}
                />
                <IconButton
                  aria-label={t('revoke')}
                  icon={<CloseIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => handleRevoke(inv.id)}
                />
              </HStack>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
