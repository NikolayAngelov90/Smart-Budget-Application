'use client';

import { Button } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/EmptyState';

interface EmptyInsightsStateProps {
  message: string;
  hasFilters?: boolean;
  /** Genuine fetch failure — shows a warning treatment + a retry action. */
  isError?: boolean;
  onRetry?: () => void;
}

/**
 * Story 16.4: delegates to the shared Quiet Ledger `EmptyState` primitive so the
 * insights page matches Transactions/Categories instead of its own dashed card.
 *
 * The error case is deliberately NOT the same as "you have no insights yet" — a
 * fetch failure rendering a cheerful lightbulb reads as guidance instead of a
 * problem, and leaves the user with no way forward.
 */
export function EmptyInsightsState({
  message,
  hasFilters = false,
  isError = false,
  onRetry,
}: EmptyInsightsStateProps) {
  const t = useTranslations('insights');
  const tCommon = useTranslations('common');

  const icon = isError ? '⚠️' : hasFilters ? '🔍' : '💡';
  const description = isError ? t('failedToLoadHint') : hasFilters ? t('adjustFilters') : undefined;

  return (
    <EmptyState
      icon={icon}
      title={message}
      description={description}
      cta={
        isError && onRetry ? (
          <Button onClick={onRetry} size="sm">
            {tCommon('retry')}
          </Button>
        ) : undefined
      }
    />
  );
}
