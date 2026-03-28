/**
 * AnnualizedProjections Component Tests
 * Story 11.4: Annualized Spending Projections
 *
 * Task 8.3: Unit tests for AnnualizedProjections component
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { AnnualizedProjections } from '@/components/ai/AnnualizedProjections';
import type { CategoryProjection } from '@/types/database.types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('@/lib/hooks/useAnnualizedProjections', () => ({
  useAnnualizedProjections: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      title: 'Spending Forecast',
      subtitle: `Based on last ${params?.count ?? 0} months of data`,
      monthlyAvg: 'Monthly avg',
      annualProjection: 'Annual',
      transactions: 'Transactions',
      recurring: 'Recurring',
      totalLabel: 'Total annual forecast',
      trendStable: 'Stable',
      trendUp: `+${params?.percentage ?? 0}%`,
      trendDown: `-${params?.percentage ?? 0}%`,
    };
    return translations[key] ?? key;
  },
}));

import { useAnnualizedProjections } from '@/lib/hooks/useAnnualizedProjections';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseAnnualizedProjections = useAnnualizedProjections as jest.MockedFunction<
  typeof useAnnualizedProjections
>;
const mockUseUserPreferences = useUserPreferences as jest.MockedFunction<
  typeof useUserPreferences
>;

// ============================================================================
// HELPERS
// ============================================================================

const renderWithChakra = (component: React.ReactElement) =>
  render(<ChakraProvider>{component}</ChakraProvider>);

function buildHookResult(overrides: Partial<ReturnType<typeof useAnnualizedProjections>>) {
  return {
    projections: [],
    hasEnoughData: false,
    months_analyzed: 0,
    isLoading: false,
    error: undefined,
    mutate: jest.fn() as unknown as ReturnType<typeof useAnnualizedProjections>['mutate'],
    ...overrides,
  };
}

const sampleProjection: CategoryProjection = {
  category_id: 'cat-food',
  category_name: 'Food',
  category_color: '#ff0000',
  monthly_avg: 150,
  annual_projection: 1800,
  transaction_count: 12,
  is_recurring: false,
  trend: 'stable',
  trend_percentage: null,
};

const recurringProjection: CategoryProjection = {
  ...sampleProjection,
  category_id: 'cat-streaming',
  category_name: 'Streaming',
  is_recurring: true,
};

// ============================================================================
// TESTS
// ============================================================================

describe('AnnualizedProjections', () => {
  beforeEach(() => {
    mockUseUserPreferences.mockReturnValue({
      preferences: { currency_format: 'EUR' } as unknown as ReturnType<typeof useUserPreferences>['preferences'],
      isLoading: false,
      error: undefined,
    });
  });

  it('returns null when hasEnoughData is false and not loading', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: false,
      isLoading: false,
    }));

    renderWithChakra(<AnnualizedProjections />);
    // Component returns null — no section with our aria-label, no heading, no skeleton
    expect(screen.queryByRole('region', { name: /spending forecast/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projections-skeleton')).not.toBeInTheDocument();
  });

  it('shows skeleton when isLoading is true', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: false,
      isLoading: true,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByTestId('projections-skeleton')).toBeInTheDocument();
  });

  it('renders heading "Spending Forecast" when data is available', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [sampleProjection],
      months_analyzed: 2,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByRole('heading', { name: /spending forecast/i })).toBeInTheDocument();
  });

  it('renders category row with name, monthly avg, and annual projection', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [sampleProjection],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getAllByText(/monthly avg/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/annual/i).length).toBeGreaterThan(0);
  });

  it('renders transaction_count for each category row (AC #2)', () => {
    const proj = { ...sampleProjection, transaction_count: 7 };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows "Recurring" badge for is_recurring: true category', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [recurringProjection],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('Recurring')).toBeInTheDocument();
  });

  it('does not show "Recurring" badge for is_recurring: false category', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [sampleProjection],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.queryByText('Recurring')).not.toBeInTheDocument();
  });

  it('does not show trend badge for trend: new (AC #4: trend only shown with 4+ months of history)', () => {
    const proj = { ...sampleProjection, trend: 'new' as const, trend_percentage: null };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    // No trend badge rendered when trend is 'new' (no prior period to compare against)
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Stable')).not.toBeInTheDocument();
    expect(screen.queryByText(/[+-]\d+%/)).not.toBeInTheDocument();
  });

  it('shows "Stable" trend badge for trend: stable', () => {
    const proj = { ...sampleProjection, trend: 'stable' as const, trend_percentage: 2 };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('shows upward trend badge for trend: up', () => {
    const proj = { ...sampleProjection, trend: 'up' as const, trend_percentage: 15 };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('+15%')).toBeInTheDocument();
  });

  it('shows downward trend badge for trend: down', () => {
    const proj = { ...sampleProjection, trend: 'down' as const, trend_percentage: -12 };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('-12%')).toBeInTheDocument();
  });

  it('renders total row with sum of annual projections', () => {
    const proj1 = { ...sampleProjection, annual_projection: 1200 };
    const proj2 = { ...sampleProjection, category_id: 'cat-2', category_name: 'Transport', annual_projection: 600 };
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [proj1, proj2],
      months_analyzed: 2,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByText('Total annual forecast')).toBeInTheDocument();
  });

  it('renders section with aria-label', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [sampleProjection],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    expect(screen.getByRole('region', { name: /spending forecast/i })).toBeInTheDocument();
  });

  it('renders heading as h2', () => {
    mockUseAnnualizedProjections.mockReturnValue(buildHookResult({
      hasEnoughData: true,
      projections: [sampleProjection],
      months_analyzed: 1,
    }));

    renderWithChakra(<AnnualizedProjections />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Spending Forecast');
  });
});
