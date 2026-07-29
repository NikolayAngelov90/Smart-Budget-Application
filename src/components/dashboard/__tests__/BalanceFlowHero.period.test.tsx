/**
 * BalanceFlowHero period selector — Story 16.6.
 *
 * The selector is only real if changing it changes the QUERY. A control that
 * re-labels the hero while the numbers stay on last month's data would look
 * right and be wrong, so these assert the period reaches the hook, and that the
 * labels follow it.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { BalanceFlowHero } from '../BalanceFlowHero';

const mockUseDashboardStats = jest.fn();
jest.mock('@/lib/hooks/useDashboardStats', () => ({
  DASHBOARD_STATS_KEY: '/api/dashboard/stats',
  useDashboardStats: (...args: unknown[]) => mockUseDashboardStats(...args),
}));
jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: jest.fn(),
}));
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ preferences: { currency_format: 'EUR' } }),
}));
jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ data: { display_name: 'Test' } }),
  PROFILE_KEY: '/api/user/profile',
}));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}));

const statsFor = (period: string) => ({
  balance: 500,
  income: { current: 2000, previous: 1000, trend: 100 },
  expenses: { current: 1500, previous: 900, trend: 66.7 },
  month: '2026-07',
  period,
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboardStats.mockImplementation((_month, _currency, period = 'month') => ({
    data: statsFor(period),
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  }));
});

const renderHero = () => render(<BalanceFlowHero />, { wrapper: ChakraProvider });
const periodOf = (call: unknown[]) => call[2];

describe('BalanceFlowHero period selector', () => {
  it('defaults to month', () => {
    renderHero();
    expect(periodOf(mockUseDashboardStats.mock.calls[0] as unknown[])).toBe('month');
    expect(screen.getByRole('radio', { name: 'periodMonth' })).toBeChecked();
  });

  it('offers all four periods as a single-choice group', () => {
    renderHero();
    const labels = screen.getAllByRole('radio').map((r) => r.getAttribute('value'));
    expect(labels).toEqual(['week', 'month', 'quarter', 'year']);
  });

  it('re-queries with the chosen period', async () => {
    const user = userEvent.setup();
    renderHero();

    await user.click(screen.getByRole('radio', { name: 'periodYear' }));

    const periods = mockUseDashboardStats.mock.calls.map((c) => periodOf(c as unknown[]));
    expect(periods).toContain('year');
    // The last render must be the selected one, not a stale month query.
    expect(periods[periods.length - 1]).toBe('year');
  });

  it('relabels the primary figure and the comparison for the chosen period', async () => {
    const user = userEvent.setup();
    renderHero();

    expect(screen.getByText('netThisMonth')).toBeInTheDocument();
    expect(screen.getByText('vsLastMonth')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'periodWeek' }));

    expect(screen.getByText('netThisWeek')).toBeInTheDocument();
    expect(screen.getByText('vsLastWeek')).toBeInTheDocument();
    // "Total Balance" was never true — it has always been a period net.
    expect(screen.queryByText('totalBalance')).not.toBeInTheDocument();
  });

  it('uses period-specific caption wording rather than month wording', async () => {
    const user = userEvent.setup();
    renderHero();

    expect(screen.getByText(/^keptShare:/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'periodQuarter' }));
    expect(screen.getByText(/^keptShareQuarter:/)).toBeInTheDocument();
    expect(screen.queryByText(/^keptShare:/)).not.toBeInTheDocument();
  });

  it('keeps the selection exposed to assistive tech', async () => {
    const user = userEvent.setup();
    renderHero();

    await user.click(screen.getByRole('radio', { name: 'periodQuarter' }));

    const group = screen.getByRole('radiogroup');
    expect(within(group).getByRole('radio', { name: 'periodQuarter' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'periodMonth' })).not.toBeChecked();
  });
});
