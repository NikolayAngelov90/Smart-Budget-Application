/**
 * Tests for BudgetHealthCard Component — ADR-025
 *
 * Progressive disclosure (null with no budgets), loading skeleton,
 * progress rows with status colors, overspend warning banner.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { BudgetHealthCard } from '@/components/dashboard/BudgetHealthCard';
import { useBudgets } from '@/lib/hooks/useBudgets';
import type { BudgetSummary } from '@/types/database.types';

jest.mock('@/lib/hooks/useBudgets', () => ({
  useBudgets: jest.fn(),
  BUDGETS_KEY: '/api/budgets',
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { currency_format: 'EUR', date_format: 'MM/DD/YYYY' },
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      healthTitle: 'Budget Health',
      manageBudgets: 'Manage budgets',
    };
    if (key === 'spentOfLimit') return `${params?.spent} of ${params?.limit}`;
    if (key === 'remainingThisMonth') return `${params?.amount} left this month`;
    if (key === 'overBy') return `Over budget by ${params?.amount}`;
    if (key === 'overBudgetWarning') return `${params?.count} over budget`;
    if (key === 'progressAriaLabel') return `${params?.name} budget usage: ${params?.pct}%`;
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

const mockUseBudgets = useBudgets as jest.MockedFunction<typeof useBudgets>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

function makeBudget(overrides: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    id: 'b-1',
    category_id: 'cat-1',
    category_name: 'Dining',
    category_color: '#48BB78',
    limit_amount: 300,
    spent: 120,
    remaining: 180,
    pct_used: 40,
    status: 'ok',
    ...overrides,
  };
}

const hookResult = (overrides: Partial<ReturnType<typeof useBudgets>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useBudgets>;

describe('BudgetHealthCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when the user has no budgets (progressive disclosure)', () => {
    mockUseBudgets.mockReturnValue(hookResult({ data: { budgets: [], month: '2026-07' } }));
    renderWithChakra(<BudgetHealthCard />);
    expect(screen.queryByText('Budget Health')).not.toBeInTheDocument();
  });

  it('renders nothing on error (stays quiet on the dashboard)', () => {
    mockUseBudgets.mockReturnValue(hookResult({ error: new Error('boom') }));
    renderWithChakra(<BudgetHealthCard />);
    expect(screen.queryByText('Budget Health')).not.toBeInTheDocument();
  });

  it('renders nothing while loading (no skeleton flash for zero-budget users)', () => {
    mockUseBudgets.mockReturnValue(hookResult({ isLoading: true }));
    renderWithChakra(<BudgetHealthCard />);
    expect(screen.queryByText('Budget Health')).not.toBeInTheDocument();
  });

  it('keeps showing stale data through a transient error (keepPreviousData)', () => {
    mockUseBudgets.mockReturnValue(
      hookResult({
        data: { budgets: [makeBudget()], month: '2026-07' },
        error: new Error('transient 500'),
      })
    );
    renderWithChakra(<BudgetHealthCard />);
    expect(screen.getByText('Budget Health')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });

  it('renders budget rows with progress and remaining amount', () => {
    mockUseBudgets.mockReturnValue(
      hookResult({ data: { budgets: [makeBudget()], month: '2026-07' } })
    );
    renderWithChakra(<BudgetHealthCard />);

    expect(screen.getByText('Budget Health')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText(/left this month/)).toBeInTheDocument();
    expect(screen.getByLabelText('Dining budget usage: 40%')).toBeInTheDocument();
  });

  it('shows the overspend banner and over-by text for over-budget categories', () => {
    mockUseBudgets.mockReturnValue(
      hookResult({
        data: {
          budgets: [
            makeBudget({
              id: 'b-2',
              category_name: 'Transport',
              spent: 350,
              remaining: -50,
              pct_used: 116.7,
              status: 'over',
            }),
          ],
          month: '2026-07',
        },
      })
    );
    renderWithChakra(<BudgetHealthCard />);

    expect(screen.getByText('1 over budget')).toBeInTheDocument();
    expect(screen.getByText(/Over budget by/)).toBeInTheDocument();
  });

  it('links to the categories page for budget management', () => {
    mockUseBudgets.mockReturnValue(
      hookResult({ data: { budgets: [makeBudget()], month: '2026-07' } })
    );
    renderWithChakra(<BudgetHealthCard />);

    const link = screen.getByRole('link', { name: 'Manage budgets' });
    expect(link).toHaveAttribute('href', '/categories');
  });
});
