/**
 * SpendingTrendsChart — window label and states.
 *
 * The component had no render coverage at all, which is how the window label
 * shipped twice with the wrong source: first hardcoded "(Last 6 Months)" over a
 * chart drawing 3 points on mobile, then derived from the REQUEST, so a user
 * with two months of history saw a 2-point line captioned "Last 6 months".
 *
 * Recharts draws inside a ResponsiveContainer that is zero-width in jsdom, so
 * the plotted series is not assertable here. The caption, the empty states and
 * the error state are — and the caption is the thing that kept being wrong.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SpendingTrendsChart } from '../SpendingTrendsChart';

const mockUseTrends = jest.fn();
jest.mock('@/lib/hooks/useTrends', () => ({
  useTrends: (...args: unknown[]) => mockUseTrends(...args),
}));
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: jest.fn(),
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/lib/hooks/useChartColors', () => ({
  useChartColors: () => ({
    accent: '#000', tick: '#000', grid: '#000', axis: '#000',
    income: '#0B5E4A', expense: '#C4593A', cursor: '#000',
  }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// Interpolating so the count is visible in the assertion.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const monthsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    month: `2026-0${i + 1}`,
    monthLabel: `M${i + 1}`,
    income: 1000,
    expenses: 500,
    net: 500,
  }));

const trends = (n: number) => ({
  data: { months: monthsOf(n) },
  error: undefined,
  isLoading: false,
  mutate: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTrends.mockReturnValue(trends(6));
});

const renderChart = (props = {}) =>
  render(<SpendingTrendsChart {...props} />, { wrapper: ChakraProvider });

describe('the window label counts what was drawn', () => {
  it('reports the number of points the API returned', () => {
    mockUseTrends.mockReturnValue(trends(6));

    renderChart();

    expect(screen.getByText('spendingTrendsWindow:{"count":6}')).toBeInTheDocument();
  });

  it('does not claim six months for a user who only has two', () => {
    // The defect: the caption came from the REQUEST, so a short history was
    // labelled with the window that had been asked for.
    mockUseTrends.mockReturnValue(trends(2));

    renderChart();

    expect(screen.getByText('spendingTrendsWindow:{"count":2}')).toBeInTheDocument();
    expect(screen.queryByText('spendingTrendsWindow:{"count":6}')).not.toBeInTheDocument();
  });

  it('passes a singular count through, for the plural rule to handle', () => {
    mockUseTrends.mockReturnValue(trends(1));

    renderChart();

    // "Last 1 months" was the bug; the ICU plural in the message file resolves
    // this, and the component's job is only to hand over the real number.
    expect(screen.getByText('spendingTrendsWindow:{"count":1}')).toBeInTheDocument();
  });
});

describe('states', () => {
  it('localizes the error state', () => {
    mockUseTrends.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      mutate: jest.fn(),
    });

    renderChart();

    expect(screen.getByText('trendsError')).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load spending trends/i)).not.toBeInTheDocument();
  });

  it('localizes the empty state', () => {
    mockUseTrends.mockReturnValue({
      data: { months: [] },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderChart();

    expect(screen.getByText('trendsEmpty')).toBeInTheDocument();
    expect(screen.queryByText(/Add transactions to see trends/i)).not.toBeInTheDocument();
  });

  it('treats an all-zero series as empty', () => {
    mockUseTrends.mockReturnValue({
      data: {
        months: monthsOf(3).map((m) => ({ ...m, income: 0, expenses: 0, net: 0 })),
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderChart();

    expect(screen.getByText('trendsEmpty')).toBeInTheDocument();
  });
});
