/**
 * @jest-environment jsdom
 */

/**
 * THE CALL SITE. This is the guard that the service's own suite cannot provide.
 *
 * `POST /api/insights/:id/track` shipped in Epic 6, was correct, was covered,
 * and wrote nothing for the life of the product — because nothing invoked it.
 * A passing service test proves the function works; it stays green whether or
 * not anything calls it, which is precisely the state the product was already
 * in. Verified at the layer of "does the handler work", never at "does anything
 * invoke it".
 *
 * So this file asserts the WIRING, and asserts arguments rather than call counts
 * so it cannot be satisfied by the pre-existing `trackInsightViewed`, which
 * posts to `/api/analytics/track` — a different endpoint writing a different
 * table for a different question.
 *
 * MUTATION RECORD — applied, run, observed RED, reverted:
 *   1. Remove the `trackInsightEngagement` call from `handleSeeDetails`
 *      -> "records metadata_expand when the user opens the details" FAILS
 *         (0 calls, expected 1).
 *   2. Drop the `if (!isDismissed)` guard around that call
 *      -> "does NOT record engagement for a dismissed card" FAILS (1 call,
 *         expected 0).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { Insight } from '@/types/database.types';
import { AIInsightCard } from '../AIInsightCard';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/services/analyticsService', () => ({
  trackInsightViewed: jest.fn(),
  trackInsightDismissed: jest.fn(),
}));

const trackInsightEngagement = jest.fn().mockResolvedValue('tracked');
jest.mock('@/lib/services/insightEngagementService', () => ({
  trackInsightEngagement: (...args: unknown[]) => trackInsightEngagement(...args),
}));

const insight: Insight = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'u-1',
  title: 'Unusual Shopping expense',
  description: 'much higher than your typical spend',
  type: 'unusual_expense',
  priority: 5,
  is_dismissed: false,
  metadata: { category_name: 'Shopping', transaction_amount: 700 },
  created_at: '2026-09-17T09:00:00.000Z',
  // The columns this whole change exists to populate. Zero here is the honest
  // starting state for a freshly generated card.
  view_count: 0,
  first_viewed_at: null,
  last_viewed_at: null,
  metadata_expanded_count: 0,
  last_metadata_expanded_at: null,
  dismissed_at: null,
};

const renderCard = (props: Partial<React.ComponentProps<typeof AIInsightCard>> = {}) =>
  render(
    <ChakraProvider>
      <AIInsightCard insight={insight} onDismiss={jest.fn()} expandable {...props} />
    </ChakraProvider>
  );

beforeEach(() => {
  trackInsightEngagement.mockClear();
  // jsdom has no IntersectionObserver. The view path is exercised in the
  // service suite; this file is about the call site for metadata_expand.
  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    class {
      observe() {}
      disconnect() {}
    };
});

describe('insight engagement wiring', () => {
  it('records metadata_expand when the user opens the details', () => {
    renderCard();

    const details = screen.getByRole('button', { name: /details/i });
    fireEvent.click(details);

    // The ARGUMENTS are the assertion. A call count alone would be satisfied by
    // the analytics-events call that was already there and writes elsewhere.
    expect(trackInsightEngagement).toHaveBeenCalledWith(insight.id, 'metadata_expand');
  });

  it('does NOT record engagement for a dismissed card', () => {
    // The quality metric reads "dismissed AND never expanded" as noise. A user
    // reviewing the dismissed filter would otherwise silently reclassify their
    // own dismissed cards as read-and-handled, inverting the signal.
    renderCard({ isDismissed: true });

    const details = screen.queryByRole('button', { name: /details/i });
    if (details) fireEvent.click(details);

    expect(trackInsightEngagement).not.toHaveBeenCalled();
  });
});
