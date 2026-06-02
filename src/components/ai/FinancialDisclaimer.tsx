'use client';

/**
 * FinancialDisclaimer Component
 * Story 12.7 (plan 12.1): Financial Advice Disclaimers — FR39
 *
 * Displays a clear disclaimer that AI-generated content is for educational
 * purposes only and is not licensed financial advice. Rendered on every
 * surface that shows AI insights, nudges, or recovery plans, plus a
 * persistent full version in Settings.
 *
 * Variants:
 *   - 'compact' (default): subtle inline note that does not obstruct content
 *   - 'full': fuller explanatory block for the Settings / About surface
 */

import { Alert, AlertDescription, AlertIcon, Box, Text } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

interface FinancialDisclaimerProps {
  variant?: 'compact' | 'full';
}

export function FinancialDisclaimer({ variant = 'compact' }: FinancialDisclaimerProps) {
  const t = useTranslations('disclaimer');

  if (variant === 'full') {
    return (
      <Alert
        status="info"
        variant="left-accent"
        borderRadius="md"
        alignItems="flex-start"
        role="note"
      >
        <AlertIcon mt={1} />
        <Box>
          <AlertDescription fontSize="sm">{t('full')}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  // Compact inline note — muted, non-obstructive
  return (
    <Text
      fontSize="xs"
      color="gray.500"
      fontStyle="italic"
      role="note"
      aria-label={t('compact')}
    >
      {t('compact')}
    </Text>
  );
}
