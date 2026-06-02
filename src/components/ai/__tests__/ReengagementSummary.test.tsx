/**
 * ReengagementSummary Component Tests — Story 12.6 / FR8
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { ReengagementSummary } from '@/components/ai/ReengagementSummary';
import type { ReengagementSummary as Summary } from '@/types/database.types';

jest.mock('@/lib/hooks/useReengagement', () => ({
  useReengagement: jest.fn(),
}));

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'Welcome back!',
      subtitle: `It's been ${params?.days ?? 0} days since your last entry.`,
      typicalSpend: 'Your typical monthly spend',
      subscriptions: `${params?.count ?? 0} active subscriptions`,
      subscriptionsTotal: `~${params?.total ?? ''}/mo`,
      goalsHeading: 'Your goals',
      recommendedAction: 'Suggested next step',
      dismiss: 'Dismiss',
      compact: 'For educational purposes only — not licensed financial advice.',
    };
    return map[key] ?? key;
  },
}));

import { useReengagement } from '@/lib/hooks/useReengagement';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

const mockUseReengagement = useReengagement as jest.MockedFunction<typeof useReengagement>;
const mockUsePrefs = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);
const PREFS = { preferences: { currency_format: 'USD' } } as ReturnType<typeof useUserPreferences>;

function hookResult(overrides: Partial<ReturnType<typeof useReengagement>>) {
  return {
    summary: null,
    isLoading: false,
    error: undefined,
    mutate: jest.fn() as unknown as ReturnType<typeof useReengagement>['mutate'],
    dismiss: jest.fn(),
    ...overrides,
  };
}

const SUMMARY: Summary = {
  lapsed_days: 30,
  last_active_date: '2026-05-16',
  typical_monthly_spend: 300,
  active_subscription_count: 2,
  active_subscription_monthly_total: 25,
  goals: [{ id: 'g1', name: 'Vacation', current_amount: 500, target_amount: 1000, pct: 50 }],
  recommended_action: 'Review your 2 subscriptions.',
};

describe('ReengagementSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrefs.mockReturnValue(PREFS);
  });

  it('renders nothing when no summary', () => {
    mockUseReengagement.mockReturnValue(hookResult({ summary: null, isLoading: false }));
    renderWithChakra(<ReengagementSummary />);
    expect(screen.queryByRole('heading', { name: /welcome back/i })).not.toBeInTheDocument();
  });

  it('renders skeleton while loading', () => {
    mockUseReengagement.mockReturnValue(hookResult({ isLoading: true }));
    renderWithChakra(<ReengagementSummary />);
    expect(screen.getByTestId('reengagement-skeleton')).toBeInTheDocument();
  });

  it('renders the summary sections and recommended action', () => {
    mockUseReengagement.mockReturnValue(hookResult({ summary: SUMMARY }));
    renderWithChakra(<ReengagementSummary />);
    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
    expect(screen.getByText(/It's been 30 days/)).toBeInTheDocument();
    expect(screen.getByText('Vacation')).toBeInTheDocument();
    expect(screen.getByText('Review your 2 subscriptions.')).toBeInTheDocument();
  });

  it('renders the FinancialDisclaimer (AC #6)', () => {
    mockUseReengagement.mockReturnValue(hookResult({ summary: SUMMARY }));
    renderWithChakra(<ReengagementSummary />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('calls dismiss when the close button is clicked', async () => {
    const dismiss = jest.fn().mockResolvedValue(undefined);
    mockUseReengagement.mockReturnValue(hookResult({ summary: SUMMARY, dismiss }));
    renderWithChakra(<ReengagementSummary />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
    });
    expect(dismiss).toHaveBeenCalled();
  });
});
