'use client';

/**
 * SmartNudge Component — Story 12.3
 *
 * Displays a non-blocking coaching-tone alert banner when a transaction
 * triggers a spending nudge (≥80% or ≥100% of historical category avg).
 *
 * - 'approaching' (80-99%): blue info alert
 * - 'exceeded' (100%+): orange warning alert
 * - Dismiss button clears the nudge
 */

import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, CloseButton, Flex } from '@chakra-ui/react';
import type { NudgePayload } from '@/types/database.types';

interface SmartNudgeProps {
  nudge: NudgePayload | null;
  onDismiss: () => void;
}

export function SmartNudge({ nudge, onDismiss }: SmartNudgeProps) {
  if (!nudge) return null;

  const status = nudge.severity === 'exceeded' ? 'warning' : 'info';

  return (
    <Box mb={4} role="alert" aria-live="polite">
      <Alert status={status} borderRadius="md" alignItems="flex-start">
        <AlertIcon mt={1} />
        <Box flex="1">
          <AlertTitle>{nudge.title}</AlertTitle>
          <AlertDescription fontSize="sm">{nudge.body}</AlertDescription>
        </Box>
        <Flex flexShrink={0} ml={2}>
          <CloseButton
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss nudge"
          />
        </Flex>
      </Alert>
    </Box>
  );
}
