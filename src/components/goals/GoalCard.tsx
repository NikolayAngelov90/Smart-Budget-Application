'use client';

/**
 * GoalCard Component
 * Story 11.5: Savings Goals
 * Story 11.6: Goal Milestone Celebrations
 *
 * Card displaying a single savings goal with progress, actions (edit, delete,
 * contribute), milestone detection, and an accessible AlertDialog for delete.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
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
// M1: lazy-load per ADR-020 (gamification components must not inflate initial bundle)
const MilestoneOverlay = dynamic(
  () => import('./MilestoneOverlay').then(m => ({ default: m.MilestoneOverlay })),
  { ssr: false },
);

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

  const {
    isOpen: isMilestoneOpen,
    onOpen: onMilestoneOpen,
    onClose: onMilestoneClose,
  } = useDisclosure();

  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const prevPercentageRef = useRef<number | null>(null);
  const justTriggeredRef = useRef<Set<number>>(new Set());
  // L3: use ref to read latest milestones_celebrated without it being a dep —
  // avoids unnecessary effect re-runs on every SWR poll (array identity changes)
  const celebratedRef = useRef<number[]>(goal.milestones_celebrated ?? []);
  celebratedRef.current = goal.milestones_celebrated ?? [];

  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);

  const currentPercentage =
    goal.target_amount > 0
      ? Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100))
      : 0;

  useEffect(() => {
    const MILESTONES = [25, 50, 75, 100] as const;
    const prevPct = prevPercentageRef.current;

    if (prevPct !== null && prevPct !== currentPercentage) {
      for (const threshold of MILESTONES) {
        if (
          currentPercentage >= threshold &&
          prevPct < threshold &&
          !celebratedRef.current.includes(threshold) &&
          !justTriggeredRef.current.has(threshold)
        ) {
          justTriggeredRef.current.add(threshold);
          setActiveMilestone(threshold);
          onMilestoneOpen();
          // M3: persist to DB then revalidate; call onMutate on both success and failure
          void fetch(`/api/goals/${goal.id}/celebrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold }),
          }).then(() => onMutate()).catch(() => onMutate());
          break; // Only one milestone at a time
        }
      }
    }

    prevPercentageRef.current = currentPercentage;
  }, [currentPercentage, goal.id, onMilestoneOpen, onMutate]);

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

  const celebratedMilestones = goal.milestones_celebrated ?? [];
  const highestMilestone =
    celebratedMilestones.length > 0
      ? Math.max(...celebratedMilestones)
      : null;

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

          {highestMilestone !== null && (
            <Badge colorScheme="purple" mt={2} data-testid="milestone-badge">
              {t('milestoneBadge', { percentage: highestMilestone })}
            </Badge>
          )}

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

      {/* H1: always mounted so its aria-live region pre-exists in DOM before isOpen fires */}
      <MilestoneOverlay
        isOpen={isMilestoneOpen}
        onClose={onMilestoneClose}
        milestone={activeMilestone ?? 25}
        goalName={goal.name}
        currentAmount={Number(goal.current_amount)}
        currency={currency}
      />
    </>
  );
}
