/**
 * @jest-environment jsdom
 */

/**
 * THE EMPTY STATE WAS COLLABORATING WITH THE BUG.
 *
 * It read "No insights available yet. Check back soon for personalized budget
 * recommendations!" — a promise that insights arrive on their own — while the
 * automatic trigger was dropping its work on every request. And the CTA was
 * rendered only when `isError`, so the healthy-empty case offered no action at
 * all. The user was told to wait, and waited.
 *
 * These assert the three cases are distinct, because collapsing any two of them
 * is how the original wording happened: "nothing to show" is not "something
 * broke" is not "your filters exclude everything", and each wants a different
 * action.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { EmptyInsightsState } from '../EmptyInsightsState';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

// The real button posts to the generate endpoint; this file is about WHICH
// affordance appears, not what it does when pressed.
jest.mock('../RefreshInsightsButton', () => ({
  RefreshInsightsButton: () => <button type="button">generate-insights-button</button>,
}));

const renderState = (props: Partial<React.ComponentProps<typeof EmptyInsightsState>> = {}) =>
  render(
    <ChakraProvider>
      <EmptyInsightsState message="nothing here" {...props} />
    </ChakraProvider>
  );

describe('EmptyInsightsState — which action each case offers', () => {
  it('offers GENERATE when there is simply nothing yet', () => {
    // The case that had no button for the life of the feature.
    renderState();

    expect(screen.getByText('generate-insights-button')).toBeInTheDocument();
  });

  it('explains when insights appear, rather than saying only that there are none', () => {
    // The old copy promised automatic arrival with no way to ask. The hint is
    // what makes "nothing yet" actionable instead of a dead end.
    renderState();

    expect(screen.getByText('noInsightsYetHint')).toBeInTheDocument();
  });

  it('offers RETRY, not generate, when the fetch failed', () => {
    // A fetch failure is not "you have no insights". Generating on a broken
    // connection would fail again and read as the feature being broken.
    renderState({ isError: true, onRetry: jest.fn() });

    expect(screen.queryByText('generate-insights-button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('offers NEITHER when filters are hiding everything', () => {
    // This user has insights; their filters exclude them. Offering "generate"
    // answers a question they did not ask — what they need is to clear a filter,
    // which is what the description tells them.
    renderState({ hasFilters: true });

    expect(screen.queryByText('generate-insights-button')).not.toBeInTheDocument();
    expect(screen.getByText('adjustFilters')).toBeInTheDocument();
  });
});
