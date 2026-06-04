'use client';

/**
 * Join Household page — Story 13.3
 *
 * Target of the invite link 13-2 generates (/join?token=…). Requires auth
 * (redirects to login and returns here). Validates the token server-side, shows
 * the household + Accept, or a clear error. Acceptance is server-side and email-bound.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Heading,
  Text,
  VStack,
  Skeleton,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { mutate } from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { InvitationValidation } from '@/lib/services/invitationService';

function JoinContent() {
  const t = useTranslations('join');
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [validation, setValidation] = useState<InvitationValidation | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Require auth; send to login and return to this exact link afterward.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const returnTo = `/join?token=${encodeURIComponent(token)}`;
        router.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }
      setCheckingAuth(false);
    });
  }, [router, token]);

  // Validate the token (read-only) once authenticated.
  useEffect(() => {
    if (checkingAuth) return;
    if (!token) {
      setValidation({ valid: false, reason: 'invalid' });
      return;
    }
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => setValidation((json?.data as InvitationValidation) ?? { valid: false, reason: 'invalid' }))
      .catch(() => setValidation({ valid: false, reason: 'invalid' }));
  }, [checkingAuth, token]);

  const handleAccept = useCallback(async () => {
    setIsAccepting(true);
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message || t('acceptFailed'));
      }
      await mutate('/api/households');
      toast({ title: t('joined'), status: 'success', duration: 3000, isClosable: true });
      router.push('/settings');
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('acceptFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsAccepting(false);
    }
  }, [token, router, toast, t]);

  const reasonMessage = (reason: InvitationValidation['reason']): string => {
    switch (reason) {
      case 'not_pending':
        return t('errorUsed');
      case 'expired':
        return t('errorExpired');
      case 'email_mismatch':
        return t('errorEmailMismatch');
      case 'already_in_household':
        return t('errorAlreadyMember');
      default:
        return t('errorInvalid');
    }
  };

  return (
    <Container maxW="md" py={16}>
      <Card>
        <CardBody>
          <VStack spacing={5} align="stretch">
            <Heading as="h1" size="lg" color="gray.800">
              {t('title')}
            </Heading>

            {checkingAuth || validation === null ? (
              <Skeleton height="80px" borderRadius="md" />
            ) : validation.valid ? (
              <>
                <Text color="gray.700">
                  {t('invitePrompt', { household: validation.householdName ?? t('aHousehold') })}
                </Text>
                <Button
                  colorScheme="blue"
                  onClick={handleAccept}
                  isLoading={isAccepting}
                  loadingText={t('joining')}
                  size="lg"
                >
                  {t('accept')}
                </Button>
              </>
            ) : (
              <>
                <Box bg="red.50" border="1px" borderColor="red.200" borderRadius="md" p={4}>
                  <Text color="red.700">{reasonMessage(validation.reason)}</Text>
                </Box>
                <Button as="a" href="/dashboard" variant="outline">
                  {t('goToDashboard')}
                </Button>
              </>
            )}
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <Container maxW="md" py={16}>
          <Skeleton height="200px" borderRadius="md" />
        </Container>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
