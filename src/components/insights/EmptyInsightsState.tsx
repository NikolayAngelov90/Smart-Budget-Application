'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/EmptyState';

interface EmptyInsightsStateProps {
  message: string;
  hasFilters?: boolean;
}

/**
 * Story 16.4: delegates to the shared Quiet Ledger `EmptyState` primitive so the
 * insights page matches Transactions/Categories instead of its own dashed card.
 */
export function EmptyInsightsState({ message, hasFilters = false }: EmptyInsightsStateProps) {
  const t = useTranslations('insights');

  return (
    <EmptyState
      icon={hasFilters ? '🔍' : '💡'}
      title={message}
      description={hasFilters ? t('adjustFilters') : undefined}
    />
  );
}
