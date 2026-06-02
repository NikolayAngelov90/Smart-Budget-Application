/**
 * SeasonalAwareness Component Tests — Story 12.5 / FR6
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { SeasonalAwareness } from '@/components/ai/SeasonalAwareness';
import type { SeasonalMonth } from '@/types/database.types';

jest.mock('@/lib/hooks/useSeasonalAwareness', () => ({
  useSeasonalAwareness: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'Seasonal Spending Outlook',
      subtitle: `Predicted from ${params?.months ?? 0} months of history`,
      seasonalHigh: 'Seasonal high',
      predicted: 'Predicted',
      noHistory: 'No history for this month yet',
      compact: 'For educational purposes only — not licensed financial advice.',
    };
    return map[key] ?? key;
  },
}));

import { useSeasonalAwareness } from '@/lib/hooks/useSeasonalAwareness';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseSeasonal = useSeasonalAwareness as jest.MockedFunction<typeof useSeasonalAwareness>;
const mockUsePrefs = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);
const PREFS = { preferences: { currency_format: 'USD' } } as ReturnType<typeof useUserPreferences>;

function hookResult(overrides: Partial<ReturnType<typeof useSeasonalAwareness>>) {
  return {
    timeline: [],
    baselineMonthly: 0,
    monthsAnalyzed: 0,
    hasEnoughData: false,
    isLoading: false,
    error: undefined,
    mutate: jest.fn() as unknown as ReturnType<typeof useSeasonalAwareness>['mutate'],
    ...overrides,
  };
}

const TIMELINE: SeasonalMonth[] = [
  { month: '2026-07', month_label: '2026-07', month_index: 7, predicted_amount: 100, is_seasonal_high: false, historical_basis: '2025-07' },
  { month: '2026-12', month_label: '2026-12', month_index: 12, predicted_amount: 300, is_seasonal_high: true, historical_basis: '2025-12' },
];

describe('SeasonalAwareness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrefs.mockReturnValue(PREFS);
  });

  it('renders nothing when not enough data', () => {
    mockUseSeasonal.mockReturnValue(hookResult({ hasEnoughData: false, isLoading: false }));
    renderWithChakra(<SeasonalAwareness />);
    expect(screen.queryByRole('heading', { name: /seasonal/i })).not.toBeInTheDocument();
  });

  it('renders skeleton while loading', () => {
    mockUseSeasonal.mockReturnValue(hookResult({ isLoading: true }));
    renderWithChakra(<SeasonalAwareness />);
    expect(screen.getByTestId('seasonal-skeleton')).toBeInTheDocument();
  });

  it('renders the timeline with a seasonal-high badge when data present', () => {
    mockUseSeasonal.mockReturnValue(hookResult({ hasEnoughData: true, monthsAnalyzed: 12, timeline: TIMELINE }));
    renderWithChakra(<SeasonalAwareness />);
    expect(screen.getByText('Seasonal Spending Outlook')).toBeInTheDocument();
    expect(screen.getByText('Seasonal high')).toBeInTheDocument();
    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
    expect(screen.getByText('Dec 2026')).toBeInTheDocument();
  });

  it('renders the FinancialDisclaimer (AC #5)', () => {
    mockUseSeasonal.mockReturnValue(hookResult({ hasEnoughData: true, monthsAnalyzed: 12, timeline: TIMELINE }));
    renderWithChakra(<SeasonalAwareness />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
