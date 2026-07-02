/**
 * Tests for RecentTransactions Component
 *
 * Dashboard module that shows the latest 5 transactions.
 * Covers loading, error, empty, and populated states + the view-all link.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import useSWR from 'swr';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';

jest.mock('swr');

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
      recentTransactions: 'Recent Transactions',
      viewAllTransactions: 'View all',
      noRecentTransactions: 'Your latest transactions will appear here.',
      failedToLoadTransactions: 'Unable to load recent transactions.',
    };
    return map[key] ?? key;
  },
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = 'Link';
  return MockLink;
});

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const swrResult = (overrides: Partial<ReturnType<typeof useSWR>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useSWR>;

const sampleTransactions = [
  {
    id: 't-1',
    amount: 42.5,
    type: 'expense',
    date: '2026-07-01',
    notes: 'Groceries run',
    currency: 'EUR',
    category: { id: 'c-1', name: 'Groceries', color: '#48BB78', type: 'expense' },
  },
  {
    id: 't-2',
    amount: 2000,
    type: 'income',
    date: '2026-06-30',
    notes: null,
    currency: 'EUR',
    category: { id: 'c-2', name: 'Salary', color: '#4299E1', type: 'income' },
  },
];

describe('RecentTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section heading and view-all link', () => {
    mockUseSWR.mockReturnValue(
      swrResult({ data: { data: sampleTransactions, count: 2 } })
    );

    renderWithChakra(<RecentTransactions />);

    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'View all' });
    expect(link).toHaveAttribute('href', '/transactions');
  });

  it('renders transaction rows with category, notes and signed amounts', () => {
    mockUseSWR.mockReturnValue(
      swrResult({ data: { data: sampleTransactions, count: 2 } })
    );

    renderWithChakra(<RecentTransactions />);

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('Groceries run')).toBeInTheDocument();
    expect(screen.getByText(/-€42\.50/)).toBeInTheDocument();
    expect(screen.getByText(/\+€2,000\.00/)).toBeInTheDocument();
  });

  it('renders the empty state when there are no transactions', () => {
    mockUseSWR.mockReturnValue(swrResult({ data: { data: [], count: 0 } }));

    renderWithChakra(<RecentTransactions />);

    expect(
      screen.getByText('Your latest transactions will appear here.')
    ).toBeInTheDocument();
  });

  it('renders an error alert when the request fails', () => {
    mockUseSWR.mockReturnValue(swrResult({ error: new Error('boom') }));

    renderWithChakra(<RecentTransactions />);

    expect(screen.getByText('Unable to load recent transactions.')).toBeInTheDocument();
  });

  it('renders skeletons while loading', () => {
    mockUseSWR.mockReturnValue(swrResult({ isLoading: true }));

    renderWithChakra(<RecentTransactions />);

    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
  });
});
