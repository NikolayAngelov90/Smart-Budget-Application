'use client';

/**
 * The not-in-a-household state — Story 13.2, extracted in Story 17.1.
 *
 * Lifted verbatim out of `HouseholdSection`'s `else` branch so the index can
 * render it on its own. This is the ONLY thing `/household` shows to someone
 * without a household: no navigation rows into sub-pages that would have
 * nothing in them.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  Stack,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { PendingInviteBanner } from '@/components/household/PendingInviteBanner';

export function HouseholdCreateCard() {
  const t = useTranslations('household');
  const toast = useToast();
  const { mutate } = useHousehold();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) throw new Error(t('createFailed'));
      await mutate();
      setName('');
    } catch (createError) {
      toast({
        title: createError instanceof Error ? createError.message : t('createFailed'),
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack spacing={4} align="stretch">
          <Heading as="h2" size="md" color="fg">
            {t('heading')}
          </Heading>
          <VStack align="stretch" spacing={3}>
            {/* Story 13.2 follow-up: surface any invitation addressed to this user */}
            <PendingInviteBanner />
            <Text fontSize="sm" color="fg.muted">
              {t('emptyPrompt')}
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={100}
                aria-label={t('namePlaceholder')}
                minH={{ base: '44px', sm: '40px' }}
              />
              <Button
                colorScheme="brand"
                onClick={handleCreate}
                isLoading={isSubmitting}
                loadingText={t('creating')}
                isDisabled={!name.trim()}
                flexShrink={0}
                minH={{ base: '44px', sm: '40px' }}
              >
                {t('create')}
              </Button>
            </Stack>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
}
