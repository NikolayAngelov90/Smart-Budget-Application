'use client';

import { Button } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/EmptyState';
import { RefreshInsightsButton } from './RefreshInsightsButton';

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
 *
 * THE HEALTHY-EMPTY CASE USED TO OFFER NOTHING. The CTA was rendered only when
 * `isError`, and the copy read "Check back soon for personalized budget
 * recommendations" — a promise of automatic arrival, made while the automatic
 * trigger was dropping its work on every request. A user told to wait, waited.
 * The UI was collaborating with the bug.
 *
 * Both halves are fixed: the copy says when insights appear, and the generate
 * affordance lives HERE rather than only in the page header. Even with the
 * trigger working there is a legitimate window before the volume threshold, and
 * the user should be able to ask instead of guessing.
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
  const description = isError
    ? t('failedToLoadHint')
    : hasFilters
      ? t('adjustFilters')
      : t('noInsightsYetHint');

  // Filters hiding everything is not the same as having nothing: offering
  // "generate" there would be answering a question the user did not ask, when
  // what they need is to clear a filter.
  const canGenerate = !isError && !hasFilters;

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
        ) : canGenerate ? (
          <RefreshInsightsButton size="sm" variant="solid" />
        ) : undefined
      }
    />
  );
}
