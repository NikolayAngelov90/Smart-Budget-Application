'use client';

/**
 * GoalForm Component
 * Story 11.5: Savings Goals
 *
 * Modal form for creating and editing savings goals.
 * Uses react-hook-form + zodResolver (same pattern as CategoryModal).
 */

import { useEffect } from 'react';
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
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { Goal } from '@/types/database.types';

// ============================================================================
// Validation schema
// ============================================================================

const goalSchema = z
  .object({
    name: z.string().min(1, 'Goal name is required').max(200).trim(),
    target_amount: z
      .number({ error: 'Amount is required' })
      .positive('Must be greater than 0'),
    deadline: z.string().optional().nullable(),
  })
  .refine(
    (val) => {
      if (!val.deadline) return true;
      const d = new Date(val.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return d > today;
    },
    { message: 'Deadline must be in the future', path: ['deadline'] }
  );

type GoalFormValues = z.infer<typeof goalSchema>;

// ============================================================================
// Component
// ============================================================================

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (goal: Goal) => void;
  /** Undefined = create mode; defined = edit mode */
  existingGoal?: Goal;
}

export function GoalForm({ isOpen, onClose, onSuccess, existingGoal }: GoalFormProps) {
  const t = useTranslations('goals');
  const toast = useToast();
  const isEditMode = existingGoal !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      target_amount: undefined,
      deadline: null,
    },
  });

  // Pre-fill form in edit mode, or reset to empty when create modal re-opens.
  // isOpen in deps ensures stale values are cleared each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    if (existingGoal) {
      reset({
        name: existingGoal.name,
        target_amount: existingGoal.target_amount,
        deadline: existingGoal.deadline ?? undefined,
      });
    } else {
      reset({ name: '', target_amount: undefined, deadline: null });
    }
  }, [isOpen, existingGoal, reset]);

  async function onSubmit(values: GoalFormValues) {
    try {
      const body = {
        name: values.name,
        target_amount: values.target_amount,
        deadline: values.deadline ?? null,
      };

      const url = isEditMode ? `/api/goals/${existingGoal.id}` : '/api/goals';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Request failed');
      }

      const goal = await response.json() as Goal;
      toast({
        title: isEditMode ? t('updateSuccess') : t('createSuccess'),
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onSuccess(goal);
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
        <ModalHeader>{isEditMode ? t('editGoal') : t('createGoal')}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>{t('name')}</FormLabel>
                <Input
                  placeholder={t('namePlaceholder')}
                  {...register('name')}
                />
                <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.target_amount}>
                <FormLabel>{t('targetAmount')}</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('target_amount', { valueAsNumber: true })}
                />
                <FormErrorMessage>{errors.target_amount?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.deadline}>
                <FormLabel>{t('deadlineOptional')}</FormLabel>
                <Input
                  type="date"
                  {...register('deadline')}
                />
                <FormErrorMessage>{errors.deadline?.message}</FormErrorMessage>
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
              {t('save')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
