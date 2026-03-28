'use client';

/**
 * GoalCard Component
 * Story 11.5: Savings Goals
 *
 * Card displaying a single savings goal with progress, actions (edit, delete,
 * contribute), and an accessible AlertDialog for delete confirmation.
 */

import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  IconButton,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import type { Goal } from '@/types/database.types';
import { GoalProgress } from './GoalProgress';
import { GoalForm } from './GoalForm';
import { ContributionModal } from './ContributionModal';

interface GoalCardProps {
  goal: Goal;
  currency: string;
  /** Called after any mutation so the parent can re-fetch the goals list */
  onMutate: () => void;
}

export function GoalCard({ goal, currency, onMutate }: GoalCardProps) {
  const t = useTranslations('goals');
  const toast = useToast();

  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();

  const {
    isOpen: isContribOpen,
    onOpen: onContribOpen,
    onClose: onContribClose,
  } = useDisclosure();

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  async function handleDelete() {
    try {
      const response = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      toast({
        title: t('deleteSuccess'),
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      onDeleteClose();
      onMutate();
    } catch {
      toast({
        title: 'Something went wrong',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      onDeleteClose();
    }
  }

  return (
    <>
      <Card data-testid={`goal-card-${goal.id}`}>
        <CardHeader pb={2}>
          <HStack justify="space-between" align="flex-start">
            <Heading size="sm" flex={1} mr={2}>
              {goal.name}
            </Heading>
            <HStack spacing={1} flexShrink={0}>
              <IconButton
                aria-label={t('editGoal')}
                icon={<EditIcon />}
                size="sm"
                variant="ghost"
                onClick={onEditOpen}
              />
              <IconButton
                aria-label={t('deleteGoal')}
                icon={<DeleteIcon />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={onDeleteOpen}
              />
            </HStack>
          </HStack>
        </CardHeader>

        <CardBody pt={0}>
          <GoalProgress
            currentAmount={Number(goal.current_amount)}
            targetAmount={Number(goal.target_amount)}
            currency={currency}
          />

          <Text fontSize="sm" color="gray.500" mt={2}>
            {goal.deadline
              ? `${t('deadline')}: ${goal.deadline}`
              : t('noDeadline')}
          </Text>

          <Button
            mt={3}
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={onContribOpen}
          >
            {t('addContribution')}
          </Button>
        </CardBody>
      </Card>

      {/* Edit modal */}
      <GoalForm
        isOpen={isEditOpen}
        onClose={onEditClose}
        existingGoal={goal}
        onSuccess={() => {
          onEditClose();
          onMutate();
        }}
      />

      {/* Contribution modal */}
      <ContributionModal
        isOpen={isContribOpen}
        onClose={onContribClose}
        goalId={goal.id}
        goalName={goal.name}
        onSuccess={() => {
          onContribClose();
          onMutate();
        }}
      />

      {/* Delete confirmation AlertDialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={onDeleteClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {t('deleteGoal')}
            </AlertDialogHeader>
            <AlertDialogBody>
              {t('deleteConfirm')}
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button ref={cancelDeleteRef} onClick={onDeleteClose}>
                {t('cancel')}
              </Button>
              <Button colorScheme="red" onClick={handleDelete} data-testid="confirm-delete-button">
                {t('deleteGoal')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
