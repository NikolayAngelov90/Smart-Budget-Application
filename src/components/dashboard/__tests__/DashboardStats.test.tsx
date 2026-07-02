/**
 * Tests for DashboardStats Component
 * Story 5.2: Financial Summary Cards
 *
 * Covers the 4-card summary: balance (net-vs-net trend), income, expenses,
 * and the savings rate card incl. the no-income fallback.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';

jest.mock('@/lib/hooks/useDashboardStats', () => ({
  useDashboardStats: jest.fn(),
}));

jest.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { currency_format: 'EUR', date_format: 'MM/DD/YYYY' },
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      totalBalance: 'Total Balance',
      monthlyIncome: 'Monthly Income',
      monthlyExpenses: 'Monthly Expenses',
      savingsRate: 'Savings Rate',
      noIncomeThisMonth: 'No income recorded this month',
      vsLastMonth: 'vs last month',
      failedToLoad: 'Failed to load dashboard stats',
      failedToLoadDescription: 'Unable to fetch financial data.',
    };
    return map[key] ?? key;
  },
}));

const mockUseDashboardStats = useDashboardStats as jest.MockedFunction<
  typeof useDashboardStats
>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const statsData = {
  balance: 500,
  income: { current: 2000, previous: 1000, trend: 100 },
  expenses: { current: 1500, previous: 900, trend: 66.7 },
  month: '2026-07',
};

describe('DashboardStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all four stat cards', () => {
    mockUseDashboardStats.mockReturnValue({
      data: statsData,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderWithChakra(<DashboardStats />);

    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Monthly Income')).toBeInTheDocument();
    expect(screen.getByText('Monthly Expenses')).toBeInTheDocument();
    expect(screen.getByText('Savings Rate')).toBeInTheDocument();
  });

  it('computes the savings rate from income and expenses', () => {
    mockUseDashboardStats.mockReturnValue({
      data: statsData,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderWithChakra(<DashboardStats />);

    // (2000 - 1500) / 2000 = 25%
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('compares balance against last month net balance', () => {
    mockUseDashboardStats.mockReturnValue({
      data: statsData,
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderWithChakra(<DashboardStats />);

    // Balance 500 vs previous net (1000 - 900 = 100) → +400%
    expect(screen.getByText(/400\.0% vs last month/)).toBeInTheDocument();
  });

  it('shows a fallback when there is no income this month', () => {
    mockUseDashboardStats.mockReturnValue({
      data: {
        balance: -300,
        income: { current: 0, previous: 0, trend: 0 },
        expenses: { current: 300, previous: 0, trend: 100 },
        month: '2026-07',
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    });

    renderWithChakra(<DashboardStats />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No income recorded this month')).toBeInTheDocument();
  });

  it('renders the error alert when the request fails', () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      mutate: jest.fn(),
    });

    renderWithChakra(<DashboardStats />);

    expect(screen.getByText('Failed to load dashboard stats')).toBeInTheDocument();
  });
});
