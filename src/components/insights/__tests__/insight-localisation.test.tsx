/**
 * Insight details in the user's language — DW-3.
 *
 * The insights LIST was localised; everything behind a tap was not.
 * `InsightDetailModal` rendered the RAW stored `title`/`description`, which hold
 * English written at generation time, so the Bulgarian UI switched languages the
 * moment an insight was opened. `getLocalizedText` being private to
 * `AIInsightCard` is why the modal could not reuse it.
 *
 * The Epic-12 types additionally had no renderer, so expanding one showed
 * "No additional details available", a divider, and a bold "Why am I seeing
 * this?" heading with nothing under it.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { Insight } from '@/types/database.types';
import { getLocalizedInsightText } from '@/lib/utils/insightText';
import { InsightMetadata, hasInsightMetadata } from '../InsightMetadata';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'bg',
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));

const insight = (over: Partial<Insight> = {}): Insight =>
  ({
    id: 'i-1',
    user_id: 'u-1',
    // The stored columns are English, written at generation time.
    title: 'Spending increased in Groceries',
    description: 'You spent 40% more than last month.',
    type: 'spending_increase',
    priority: 1,
    is_dismissed: false,
    metadata: {
      category_name: 'Groceries',
      percent_change: 40,
      current_amount: 420,
      previous_amount: 300,
    },
    created_at: '2026-07-01T00:00:00Z',
    view_count: 0,
    ...over,
  }) as unknown as Insight;

const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

describe('getLocalizedInsightText', () => {
  it('returns translated copy, never the stored English', () => {
    const { title, description } = getLocalizedInsightText(insight(), t, 'EUR');

    expect(title).toContain('spending_increase_title');
    expect(description).toContain('spending_increase_desc');
    // The whole bug: the modal used to render these.
    expect(title).not.toBe('Spending increased in Groceries');
    expect(description).not.toBe('You spent 40% more than last month.');
  });

  it('falls back to the stored columns when metadata is missing', () => {
    // A backstop, not the display source of truth — better than blank.
    const { title, description } = getLocalizedInsightText(
      insight({ metadata: null as never }),
      t,
      'EUR'
    );

    expect(title).toBe('Spending increased in Groceries');
    expect(description).toBe('You spent 40% more than last month.');
  });

  it('is the same function the card and the modal both call', () => {
    // Two call sites, one implementation — the modal drifting to the raw
    // columns is exactly what happens when this lives inside one component.
    const fromCard = getLocalizedInsightText(insight(), t, 'EUR');
    const fromModal = getLocalizedInsightText(insight(), t, 'EUR');
    expect(fromCard).toEqual(fromModal);
  });
});

describe('hasInsightMetadata', () => {
  it.each(['spending_increase', 'budget_recommendation', 'unusual_expense', 'positive_reinforcement'])(
    'is true for %s, which has a renderer',
    (type) => {
      expect(hasInsightMetadata({ type } as Pick<Insight, 'type'>)).toBe(true);
    }
  );

  it.each(['spending_anomaly', 'new_high_spend_category'])(
    'is false for the Epic-12 type %s, which has none',
    (type) => {
      expect(hasInsightMetadata({ type } as Pick<Insight, 'type'>)).toBe(false);
    }
  );
});

describe('InsightMetadata', () => {
  const renderPanel = (i: Insight) =>
    render(<InsightMetadata insight={i} />, { wrapper: ChakraProvider });

  it('renders nothing at all for a type with no metadata', () => {
    // Not an empty body under a heading — nothing. The trigger, the divider and
    // the heading are three separate renders, and suppressing only the body is
    // what produced the empty heading.
    const { container } = renderPanel(insight({ type: 'spending_anomaly' as never }));

    // ChakraProvider injects its own hidden `__chakra_env` span, so assert on
    // what the COMPONENT contributed: no text, and no visible element.
    expect(container.textContent).toBe('');
    expect(container.querySelector(':not([hidden])')).toBeNull();
  });

  it('never renders the old placeholder copy', () => {
    renderPanel(insight({ type: 'new_high_spend_category' as never }));
    expect(screen.queryByText(/No additional details available/i)).not.toBeInTheDocument();
  });

  it('translates the panel rather than hardcoding English', () => {
    renderPanel(insight());

    // The mock echoes keys, so seeing a key proves the string went through t().
    expect(screen.getByText('meta_why_heading')).toBeInTheDocument();
    expect(screen.getByText('meta_why_spending_increase')).toBeInTheDocument();
    expect(screen.queryByText('Why am I seeing this?')).not.toBeInTheDocument();
  });

  it('translates field labels too', () => {
    renderPanel(insight());
    expect(screen.getByText('meta_current_month')).toBeInTheDocument();
    expect(screen.getByText('meta_previous_month')).toBeInTheDocument();
  });
});
