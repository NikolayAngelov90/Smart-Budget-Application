/**
 * InsightsList — Story 16.4 composition (lead + groups).
 *
 * Guards the review findings that had no component-level coverage:
 *  - "Start here" must only appear for the top of the REAL ranking (page 1 of
 *    the live list), not once per paginated page;
 *  - the spotlighted insight stays pinned when it's dismissed, so the card the
 *    user just tapped doesn't get replaced under their finger;
 *  - groups render in order, with counts, and empty groups are omitted.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { InsightsList } from '../InsightsList';
import type { Insight } from '@/types/database.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
jest.mock('../InsightMetadata', () => ({
  // Spread the real module: the list now also imports `hasInsightMetadata` to
  // decide whether a "See details" affordance should exist at all, and a
  // component-only stub leaves it undefined.
  ...jest.requireActual('../InsightMetadata'),
  InsightMetadata: () => null,
}));
jest.mock('../InsightDetailModal', () => ({ InsightDetailModal: () => null }));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/services/analyticsService', () => ({ trackInsightViewed: jest.fn() }));

const ins = (over: Partial<Insight>): Insight =>
  ({
    id: 'i1',
    user_id: 'u1',
    type: 'budget_recommendation',
    title: 'A title',
    description: 'A description',
    priority: 3,
    is_dismissed: false,
    metadata: null,
    created_at: '2026-07-01T10:00:00Z',
    ...over,
  }) as Insight;

const renderList = (props: Partial<React.ComponentProps<typeof InsightsList>> = {}) =>
  render(
    <ChakraProvider>
      <InsightsList
        insights={[]}
        onDismiss={jest.fn()}
        onUndismiss={jest.fn()}
        {...props}
      />
    </ChakraProvider>
  );

describe('InsightsList — lead spotlight', () => {
  it('spotlights the highest-priority insight under "Start here"', () => {
    renderList({
      insights: [
        ins({ id: 'low', title: 'Low one', priority: 2 }),
        ins({ id: 'top', title: 'Top one', priority: 5, type: 'unusual_expense' }),
      ],
    });

    const leadSection = screen.getByRole('region', { name: 'leadInsight' });
    expect(within(leadSection).getByText('Top one')).toBeInTheDocument();
    // The lead is not ALSO listed in its group.
    expect(screen.getAllByText('Top one')).toHaveLength(1);
  });

  it('does NOT spotlight anything when showLead is false (page 2+ / dismissed view)', () => {
    renderList({
      insights: [ins({ id: 'top', title: 'Top one', priority: 5 })],
      showLead: false,
    });

    expect(screen.queryByRole('region', { name: 'leadInsight' })).not.toBeInTheDocument();
    // It still renders, just inside its normal group.
    expect(screen.getByText('Top one')).toBeInTheDocument();
  });

  it('keeps the lead pinned after it is dismissed (no reshuffle under the finger)', () => {
    const insights = [
      ins({ id: 'top', title: 'Top one', priority: 5 }),
      ins({ id: 'next', title: 'Next one', priority: 4 }),
    ];
    const { rerender } = renderList({ insights });

    expect(
      within(screen.getByRole('region', { name: 'leadInsight' })).getByText('Top one')
    ).toBeInTheDocument();

    // Simulate the optimistic dismiss of the lead.
    rerender(
      <ChakraProvider>
        <InsightsList
          insights={[{ ...insights[0]!, is_dismissed: true }, insights[1]!]}
          onDismiss={jest.fn()}
          onUndismiss={jest.fn()}
        />
      </ChakraProvider>
    );

    // Still the same card in the spotlight — "Next one" did not jump into it.
    const leadSection = screen.getByRole('region', { name: 'leadInsight' });
    expect(within(leadSection).getByText('Top one')).toBeInTheDocument();
    expect(within(leadSection).queryByText('Next one')).not.toBeInTheDocument();
  });
});

describe('InsightsList — groups', () => {
  it('renders non-empty groups in order with counts, omitting the rest', () => {
    renderList({
      showLead: false,
      insights: [
        ins({ id: 'a', type: 'positive_reinforcement', title: 'Progress one' }),
        ins({ id: 'b', type: 'unusual_expense', title: 'Attention one' }),
        ins({ id: 'c', type: 'unusual_expense', title: 'Attention two' }),
      ],
    });

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    // attention before progress; no 'changed'/'recommend' groups at all.
    expect(headings).toEqual(['groupAttention', 'groupProgress']);
    expect(screen.queryByText('groupChanged')).not.toBeInTheDocument();

    // Count badge reflects the group size.
    const attention = screen.getByRole('region', { name: 'groupAttention' });
    expect(within(attention).getByText('2')).toBeInTheDocument();
  });

  it('renders group titles as real headings for screen-reader navigation', () => {
    renderList({
      showLead: false,
      insights: [ins({ id: 'b', type: 'unusual_expense' })],
    });

    expect(screen.getByRole('heading', { level: 2, name: 'groupAttention' })).toBeInTheDocument();
  });

  it('renders a lone insight as the lead with no group sections', () => {
    renderList({ insights: [ins({ id: 'only', title: 'Only one' })] });

    expect(
      within(screen.getByRole('region', { name: 'leadInsight' })).getByText('Only one')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1); // just "Start here"
  });
});
