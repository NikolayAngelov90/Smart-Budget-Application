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
  FormControl,
  FormErrorMessage,
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
import { checkName, type NameProblem } from '@/lib/validation/names';
import { useNameMessage } from '@/lib/validation/useNameMessage';

export function HouseholdCreateCard() {
  const t = useTranslations('household');
  const toast = useToast();
  const { mutate } = useHousehold();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<NameProblem | undefined>();
  const nameMessage = useNameMessage();

  const handleCreate = async () => {
    // The shared name rule (spec-cyrillic-names): any script, normalised.
    const check = checkName(name, 'household');
    if (!check.ok) {
      setNameError(check.problem);
      return;
    }
    setNameError(undefined);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: check.name }),
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
              <FormControl isInvalid={!!nameError}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(undefined);
                  }}
                  placeholder={t('namePlaceholder')}
                  aria-label={t('namePlaceholder')}
                  minH={{ base: '44px', sm: '40px' }}
                />
                <FormErrorMessage>{nameMessage(nameError, 'household')}</FormErrorMessage>
              </FormControl>
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
