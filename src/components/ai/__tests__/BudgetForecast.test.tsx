/**
 * BudgetForecast Component Tests
 * Story 12.2: End-of-Month Budget Projections
 *
 * Tests: progressive disclosure, loading skeleton, at-risk/on-track badges,
 * new-category (no historical baseline), ARIA labels on projected amounts.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { BudgetForecast } from '@/components/ai/BudgetForecast';
import type { CategoryForecast } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('@/lib/hooks/useBudgetForecast', () => ({
  useBudgetForecast: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'End-of-Month Forecast',
      subtitle: `Day ${params?.day ?? 0} of ${params?.daysInMonth ?? 0} — ${params?.daysRemaining ?? 0} days remaining`,
      spentSoFar: 'Spent so far',
      projectedEOM: 'Projected EOM',
      atRisk: 'At risk',
      onTrack: 'On track',
      noData: 'No spending data for this month yet',
    };
    if (key === 'vsYourBudget') return `vs your budget of ${params?.amount ?? ''}`;
    return map[key] ?? key;
  },
}));

import { useBudgetForecast } from '@/lib/hooks/useBudgetForecast';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseBudgetForecast = useBudgetForecast as jest.MockedFunction<typeof useBudgetForecast>;
const mockUseUserPreferences = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

// ============================================================================
// HELPERS
// ============================================================================

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

const PREFS_MOCK = { preferences: { currency_format: 'USD' } } as ReturnType<typeof useUserPreferences>;

function makeForecast(overrides: Partial<CategoryForecast> = {}): CategoryForecast {
  return {
    category_id: 'cat-1',
    category_name: 'Dining',
    category_color: '#aabbcc',
    spent_so_far: 100,
    projected_eom: 300,
    historical_avg: 200,
    is_at_risk: true,
    days_elapsed: 10,
    days_in_month: 30,
    budget_amount: 200,
    budget_source: 'historical_average',
    ...overrides,
  };
}

function hookResult(overrides: Partial<ReturnType<typeof useBudgetForecast>>) {
  return {
    forecasts: [],
    hasCurrentMonthData: false,
    generated_at: null,
    isLoading: false,
    error: undefined,
    mutate: jest.fn() as unknown as ReturnType<typeof useBudgetForecast>['mutate'],
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('BudgetForecast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserPreferences.mockReturnValue(PREFS_MOCK);
  });

  describe('progressive disclosure (AC #4)', () => {
    it('renders nothing when no current-month data and not loading', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({ hasCurrentMonthData: false, isLoading: false }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.queryByRole('heading', { name: /forecast/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('budget-forecast-skeleton')).not.toBeInTheDocument();
    });

    it('renders skeleton while loading', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({ isLoading: true }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByTestId('budget-forecast-skeleton')).toBeInTheDocument();
    });

    it('renders content when hasCurrentMonthData is true', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast()],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByText('End-of-Month Forecast')).toBeInTheDocument();
    });
  });

  describe('at-risk badge (AC #2)', () => {
    it('shows "At risk" badge for at-risk categories', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast({ is_at_risk: true, historical_avg: 200 })],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByText('At risk')).toBeInTheDocument();
    });

    it('shows "On track" badge when projected ≤ historical avg and history exists', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast({ is_at_risk: false, historical_avg: 400, projected_eom: 300 })],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByText('On track')).toBeInTheDocument();
    });

    // ADR-025: the "vs your budget" sub-line renders ONLY for explicit budgets so
    // zero-config rows keep today's exact copy (frozen AC1).
    it('shows the budget sub-line for explicit budgets only', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [
          makeForecast({ budget_source: 'explicit', budget_amount: 250 }),
          makeForecast({
            category_id: 'cat-2',
            category_name: 'Transport',
            budget_source: 'historical_average',
            budget_amount: 200,
          }),
        ],
      }));
      renderWithChakra(<BudgetForecast />);
      // Exactly one sub-line: the explicit row; the average row keeps legacy copy
      expect(screen.getAllByText(/vs your budget of/)).toHaveLength(1);
    });

    it('shows NO badge for new categories with zero historical average (M2 fix)', () => {
      // No history + no explicit budget → resolver yields budget_amount 0 (no baseline)
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast({ is_at_risk: false, historical_avg: 0, budget_amount: 0 })],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.queryByText('At risk')).not.toBeInTheDocument();
      expect(screen.queryByText('On track')).not.toBeInTheDocument();
    });
  });

  describe('ARIA labels (AC #5)', () => {
    it('projected EOM amount has an aria-label', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast({ projected_eom: 300 })],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByLabelText(/Projected EOM/i)).toBeInTheDocument();
    });
  });

  describe('subtitle day info', () => {
    it('shows correct day/remaining from forecast data', () => {
      mockUseBudgetForecast.mockReturnValue(hookResult({
        hasCurrentMonthData: true,
        forecasts: [makeForecast({ days_elapsed: 10, days_in_month: 30 })],
      }));
      renderWithChakra(<BudgetForecast />);
      expect(screen.getByText(/Day 10 of 30/i)).toBeInTheDocument();
    });
  });
});
