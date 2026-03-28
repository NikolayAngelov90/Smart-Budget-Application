'use client';

/**
 * ContributionModal Component
 * Story 11.5: Savings Goals
 *
 * Modal for adding a manual contribution to a savings goal.
 * Uses react-hook-form + zodResolver.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { Goal } from '@/types/database.types';

// ============================================================================
// Validation schema
// ============================================================================

const contributionSchema = z.object({
  amount: z
    .number({ error: 'Amount is required' })
    .positive('Must be greater than 0'),
  note: z.string().optional().nullable(),
});

type ContributionFormValues = z.infer<typeof contributionSchema>;

// ============================================================================
// Component
// ============================================================================

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalName: string;
  onSuccess: (updatedGoal: Goal) => void;
}

export function ContributionModal({
  isOpen,
  onClose,
  goalId,
  goalName,
  onSuccess,
}: ContributionModalProps) {
  const t = useTranslations('goals');
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { amount: undefined, note: null },
  });

  async function onSubmit(values: ContributionFormValues) {
    try {
      const response = await fetch(`/api/goals/${goalId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: values.amount, note: values.note ?? null }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Request failed');
      }

      const updatedGoal = await response.json() as Goal;
      toast({
        title: t('contributeSuccess'),
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      reset();
      onSuccess(updatedGoal);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Something went wrong',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('contributionTitle')}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <Text fontSize="sm" color="gray.600" mb={4}>
              {goalName}
            </Text>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.amount}>
                <FormLabel>{t('contributionAmount')}</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('amount', { valueAsNumber: true })}
                />
                <FormErrorMessage>{errors.amount?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.note}>
                <FormLabel>{t('contributionNote')}</FormLabel>
                <Input
                  placeholder={t('contributionNotePlaceholder')}
                  {...register('note')}
                />
                <FormErrorMessage>{errors.note?.message}</FormErrorMessage>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isSubmitting}
            >
              {t('add')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
