'use client';

/**
 * GoalProgress Component
 * Story 11.5: Savings Goals
 *
 * Visual progress bar showing current vs target amount for a savings goal.
 */

import { Badge, Box, Progress, Text } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

/**
 * Formats a numeric amount using the user's currency (Intl.NumberFormat).
 * Empty-currency guard: falls back to fixed 2dp if currency is falsy.
 */
function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

interface GoalProgressProps {
  currentAmount: number;
  targetAmount: number;
  currency: string;
}

export function GoalProgress({ currentAmount, targetAmount, currency }: GoalProgressProps) {
  const t = useTranslations('goals');
  const percentage = targetAmount > 0
    ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
    : 0;
  const isCompleted = percentage >= 100;

  return (
    <Box>
      <Progress
        value={percentage}
        colorScheme={isCompleted ? 'green' : 'blue'}
        borderRadius="full"
        size="sm"
        mb={1}
      />
      <Text fontSize="xs" color="gray.600">
        {formatAmount(currentAmount, currency)} / {formatAmount(targetAmount, currency)}
      </Text>
      {isCompleted ? (
        <Badge colorScheme="green" mt={1}>
          {t('completed')}
        </Badge>
      ) : (
        <Text fontSize="xs" color="gray.500" mt={1}>
          {t('progress', { percentage })}
        </Text>
      )}
    </Box>
  );
}
