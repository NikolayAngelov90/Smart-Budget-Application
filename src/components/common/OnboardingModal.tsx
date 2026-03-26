/**
 * Onboarding Modal Component
 * Story 11.1: Streamlined Onboarding Flow (Phase 2 Redesign)
 *
 * Single-step personalization for new users:
 * - Display name (pre-filled from OAuth if available)
 * - Optional currency preference (default: EUR)
 * - Skip or complete in under 30 seconds
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Select,
  Heading,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { getEnabledCurrencies, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/config/currencies';

const supportedCodes = SUPPORTED_CURRENCIES.map((c) => c.code) as [string, ...string[]];

const onboardingSchema = z.object({
  displayName: z.string().max(100, 'Name must be 100 characters or less').optional().or(z.literal('')),
  currencyFormat: z.enum(supportedCodes),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (data: { displayName?: string; currencyFormat: string }) => void;
  onSkip: () => void;
  defaultDisplayName?: string;
}

export function OnboardingModal({
  isOpen,
  onComplete,
  onSkip,
  defaultDisplayName = '',
}: OnboardingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const enabledCurrencies = getEnabledCurrencies();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: defaultDisplayName,
      currencyFormat: DEFAULT_CURRENCY,
    },
  });

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      onComplete({
        displayName: data.displayName || undefined,
        currencyFormat: data.currencyFormat,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}
      isCentered
      closeOnOverlayClick={false}
      size={{ base: 'full', md: 'md' }}
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent mx={{ base: 0, md: 4 }} my={{ base: 0, md: 4 }}>
        <ModalHeader pt={8} pb={2}>
          <VStack spacing={2} align="stretch">
            <Heading as="h2" size="lg" textAlign="center" color="gray.800">
              {t('welcome')}
            </Heading>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              {t('personalizeDescription')}
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody py={6}>
          <form id="onboarding-form" onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={5} align="stretch">
              <FormControl isInvalid={!!errors.displayName}>
                <FormLabel htmlFor="displayName" fontSize="sm" fontWeight="medium">
                  {t('displayNameLabel')}
                </FormLabel>
                <Input
                  id="displayName"
                  placeholder={t('displayNamePlaceholder')}
                  size="lg"
                  {...register('displayName')}
                  aria-label={t('displayNameLabel')}
                  autoComplete="name"
                  autoFocus
                  _focus={{
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                />
                {errors.displayName && (
                  <FormErrorMessage>{errors.displayName.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="currencyFormat" fontSize="sm" fontWeight="medium">
                  {t('currencyLabel')}
                </FormLabel>
                <Select
                  id="currencyFormat"
                  size="lg"
                  {...register('currencyFormat')}
                  aria-label={t('currencyLabel')}
                  _focus={{
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                >
                  {enabledCurrencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </form>
        </ModalBody>

        <ModalFooter justifyContent="space-between" pb={8}>
          <Button
            variant="ghost"
            onClick={onSkip}
            color="gray.600"
            _hover={{ bg: 'gray.100' }}
            aria-label={tCommon('skip')}
          >
            {tCommon('skip')}
          </Button>

          <Button
            type="submit"
            form="onboarding-form"
            bg="#2b6cb0"
            color="white"
            _hover={{ bg: '#2c5282' }}
            _active={{ bg: '#2c5282' }}
            size="lg"
            minH="44px"
            px={8}
            isLoading={isSubmitting}
            loadingText={t('saving')}
            aria-label={t('getStarted')}
          >
            {t('getStarted')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
