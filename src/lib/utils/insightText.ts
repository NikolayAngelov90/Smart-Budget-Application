/**
 * Localised insight copy — DW-3.
 *
 * This used to be a closure inside `AIInsightCard`, which is why
 * `InsightDetailModal` could not reuse it and fell back to rendering the RAW
 * stored `insight.title` / `insight.description`. Those columns hold ENGLISH
 * written at generation time, so the Bulgarian UI switched languages the moment
 * you opened an insight.
 *
 * One implementation, both surfaces. The stored columns remain the fallback for
 * an insight whose metadata is missing — they are a backstop, not the source of
 * truth for display.
 */

import type { Insight, InsightMetadata } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils/currency';

/** The `next-intl` translator for the `insights` namespace. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface LocalizedInsightText {
  title: string;
  description: string;
}

export function getLocalizedInsightText(
  insight: Insight,
  t: Translate,
  currencyCode?: string
): LocalizedInsightText {
  const meta = insight.metadata as InsightMetadata | null;
  const categoryName = meta?.category_name ?? '';
  const fmt = (amount?: number) => formatCurrency(amount ?? 0, undefined, currencyCode);

  switch (insight.type) {
    case 'spending_increase': {
      if (meta?.percent_change != null && meta?.current_amount != null && meta?.previous_amount != null) {
        return {
          title: t('spending_increase_title', {
            categoryName,
            percent: Math.round(meta.percent_change),
          }),
          description: t('spending_increase_desc', {
            categoryName,
            percent: Math.round(meta.percent_change),
            currentAmount: fmt(meta.current_amount),
            previousAmount: fmt(meta.previous_amount),
          }),
        };
      }
      break;
    }
    case 'budget_recommendation': {
      if (meta?.recommended_budget != null && meta?.three_month_average != null) {
        return {
          title: t('budget_recommendation_title', {
            budget: fmt(meta.recommended_budget),
            categoryName,
          }),
          description: t('budget_recommendation_desc', {
            average: fmt(meta.three_month_average),
            budget: fmt(meta.recommended_budget),
            categoryName,
          }),
        };
      }
      break;
    }
    case 'unusual_expense': {
      if (meta?.transaction_amount != null && meta?.category_average != null) {
        return {
          title: t('unusual_expense_title', {
            categoryName,
            amount: fmt(meta.transaction_amount),
          }),
          description: t('unusual_expense_desc', {
            categoryName,
            amount: fmt(meta.transaction_amount),
            typical: fmt(meta.category_average),
          }),
        };
      }
      break;
    }
    case 'positive_reinforcement': {
      if (meta?.percent_under_budget != null && meta?.savings_amount != null) {
        return {
          title: t('positive_reinforcement_title', { categoryName }),
          description: t('positive_reinforcement_desc', {
            categoryName,
            percent: Math.round(meta.percent_under_budget),
            savings: fmt(meta.savings_amount),
          }),
        };
      }
      break;
    }
  }
  // Fallback to stored values if metadata is missing
  return { title: insight.title ?? '', description: insight.description ?? '' };
}
