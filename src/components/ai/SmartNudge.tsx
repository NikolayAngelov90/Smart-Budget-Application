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
import { useTranslations } from 'next-intl';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';
import type { NudgePayload } from '@/types/database.types';

interface SmartNudgeProps {
  nudge: NudgePayload | null;
  onDismiss: () => void;
}

export function SmartNudge({ nudge, onDismiss }: SmartNudgeProps) {
  const t = useTranslations('smartNudge');

  if (!nudge) return null;

  const status = nudge.severity === 'exceeded' ? 'warning' : 'info';

  // Story 15.8 (AC2): role="status" (implies polite) — NOT role="alert", which
  // forces an assertive, interruptive announcement inappropriate for a
  // non-blocking coaching nudge. The role goes on the Alert itself to OVERRIDE
  // Chakra's hardcoded default role="alert"; explicit aria-live="polite" for
  // older SRs. (A wrapper role alone leaves the inner Alert's alert role live.)
  return (
    <Box mb={4}>
      <Alert
        status={status}
        role="status"
        aria-live="polite"
        borderRadius="md"
        alignItems="flex-start"
      >
        <AlertIcon mt={1} />
        <Box flex="1">
          <AlertTitle>{nudge.title}</AlertTitle>
          <AlertDescription fontSize="sm">{nudge.body}</AlertDescription>
          {/* FR39: Financial advice disclaimer on AI-generated nudge */}
          <Box mt={2}>
            <FinancialDisclaimer />
          </Box>
        </Box>
        <Flex flexShrink={0} ml={2}>
          <CloseButton
            size="sm"
            onClick={onDismiss}
            aria-label={t('dismiss')}
          />
        </Flex>
      </Alert>
    </Box>
  );
}
