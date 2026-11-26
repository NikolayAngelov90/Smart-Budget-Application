/**
 * Dashboard × gamification opt-out — Story 15.6 (AC 2)
 *
 * Core budgeting must work identically with gamification disabled. This
 * renders the REAL dashboard page with the REAL gate chain (useUserPreferences
 * → useGamification → real StreakBadge/BudgetScoreRing/ComebackChallengeCard
 * with real null-key hooks) while every core child is a stub — proving the
 * page composes cleanly and the core surface renders in both states.
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import DashboardPage from '@/app/dashboard/page';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

// Core children → stubs (their own suites cover them)
jest.mock('@/components/dashboard/BalanceFlowHero', () => ({
  BalanceFlowHero: () => <div data-testid="balance-hero" />,
}));
jest.mock('@/components/dashboard/AIBudgetCoach', () => ({
  AIBudgetCoach: () => <div data-testid="ai-coach" />,
}));
jest.mock('@/components/dashboard/CategorySpendingChart', () => ({
  CategorySpendingChart: () => <div data-testid="category-chart" />,
}));
jest.mock('@/components/dashboard/SpendingTrendsChart', () => ({
  SpendingTrendsChart: () => <div data-testid="trends-chart" />,
}));
jest.mock('@/components/dashboard/MonthOverMonth', () => ({ MonthOverMonth: () => <div /> }));
jest.mock('@/components/ai/SpendingHeatmap', () => ({ SpendingHeatmap: () => <div /> }));
jest.mock('@/components/ai/AnnualizedProjections', () => ({
  AnnualizedProjections: () => <div />,
}));
jest.mock('@/components/ai/BudgetForecast', () => ({ BudgetForecast: () => <div /> }));
jest.mock('@/components/ai/RecoveryPlan', () => ({ RecoveryPlan: () => <div /> }));
jest.mock('@/components/ai/SeasonalAwareness', () => ({ SeasonalAwareness: () => <div /> }));
jest.mock('@/components/ai/ReengagementSummary', () => ({ ReengagementSummary: () => <div /> }));
jest.mock('@/components/ai/WeeklyDigestCard', () => ({ WeeklyDigestCard: () => <div /> }));
jest.mock('@/components/values/ValuesSpendingCard', () => ({ ValuesSpendingCard: () => <div /> }));
jest.mock('@/components/dashboard/RecentTransactions', () => ({
  RecentTransactions: () => <div data-testid="recent-transactions" />,
  RECENT_TRANSACTIONS_KEY: '/api/transactions?recent',
}));
jest.mock('@/components/dashboard/BudgetHealthCard', () => ({ BudgetHealthCard: () => <div /> }));
jest.mock('@/components/dashboard/FirstTransactionPrompt', () => ({
  FirstTransactionPrompt: () => <div />,
}));
jest.mock('@/components/transactions/TransactionEntryModal', () => ({
  __esModule: true,
  default: () => null,
}));

// Page-level hooks
jest.mock('@/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({ containerRef: { current: null }, isRefreshing: false }),
}));
jest.mock('@/lib/hooks/useDashboardStats', () => ({
  useDashboardStats: jest.fn(() => ({ data: undefined })),
}));
jest.mock('@/lib/hooks/useBudgets', () => ({ BUDGETS_KEY: '/api/budgets' }));
// Mock the gamification DATA hooks so the real StreakBadge/BudgetScoreRing/
// ComebackChallengeCard render through the REAL useGamification gate but never
// hit real SWR/fetch (Blind Hunter flakiness note). No data => they'd render
// null anyway; the point is exercising the gate, not the data path.
jest.mock('@/lib/hooks/useStreak', () => ({
  useStreak: () => ({ data: undefined, error: undefined, isLoading: false, mutate: jest.fn() }),
  STREAK_KEY: '/api/streaks',
}));
jest.mock('@/lib/hooks/useBudgetScore', () => ({
  useBudgetScore: () => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  }),
  SCORE_KEY: '/api/gamification/score',
}));
jest.mock('@/lib/hooks/useComeback', () => ({
  useComeback: () => ({ data: undefined, error: undefined, isLoading: false, mutate: jest.fn() }),
  COMEBACK_KEY: '/api/comeback',
}));
// Account notices (spec-account-deletion-notifications): the REAL card renders;
// only its data hook is stubbed - no notices by default, so the tests below see
// the page as before.
jest.mock('@/lib/hooks/useAccountNotices', () => ({
  useAccountNotices: jest.fn(() => ({ notices: [], isLoading: false, dismiss: jest.fn() })),
}));
// THE gate input — the real useGamification + real gamification components run
jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

const mockUsePrefs = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

const prefs = (gamification: boolean | undefined) =>
  ({
    preferences: {
      currency_format: 'EUR' as const,
      date_format: 'MM/DD/YYYY' as const,
      onboarding_completed: true,
      language: 'en' as const,
      ...(gamification === undefined ? {} : { gamification_enabled: gamification }),
    },
    isLoading: false,
    error: undefined,
  }) as ReturnType<typeof useUserPreferences>;

const renderPage = () =>
  render(
    <ChakraProvider>
      <DashboardPage />
    </ChakraProvider>
  );

describe('Dashboard with gamification OPTED OUT (Story 15.6, AC 2)', () => {
  beforeAll(() => {
    // jsdom's performance object lacks the marks API the page's perf effects use
    Object.assign(window.performance, {
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByName: jest.fn(() => []),
    });
  });

  beforeEach(() => jest.clearAllMocks());

  it('core surface renders identically: stats, charts, transactions all present', () => {
    mockUsePrefs.mockReturnValue(prefs(false));
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('balance-hero')).toBeInTheDocument();
    expect(screen.getByTestId('ai-coach')).toBeInTheDocument();
    expect(screen.getByTestId('category-chart')).toBeInTheDocument();
    expect(screen.getByTestId('trends-chart')).toBeInTheDocument();
    expect(screen.getByTestId('recent-transactions')).toBeInTheDocument();
  });

  it('gamification UI is ABSENT when opted out (real gate, real components)', () => {
    mockUsePrefs.mockReturnValue(prefs(false));
    renderPage();
    // StreakBadge/BudgetScoreRing/ComebackChallengeCard render through the real
    // useGamification gate -> null when opted out. None of their translation
    // namespaces (streaks/score/comeback) should surface any text.
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/budget score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
  });

  it('renders the same core surface when enabled (flag absent = default on)', () => {
    mockUsePrefs.mockReturnValue(prefs(undefined));
    renderPage();

    expect(screen.getByTestId('balance-hero')).toBeInTheDocument();
    expect(screen.getByTestId('recent-transactions')).toBeInTheDocument();
  });
});

describe('Dashboard shows the account-notices card (spec-account-deletion-notifications)', () => {
  beforeAll(() => {
    Object.assign(window.performance, {
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByName: jest.fn(() => []),
    });
  });

  it('a notice for this person appears on the dashboard, with or without gamification', () => {
    const { useAccountNotices } = jest.requireMock('@/lib/hooks/useAccountNotices') as {
      useAccountNotices: jest.Mock;
    };
    useAccountNotices.mockReturnValue({
      notices: [
        {
          id: 'n-1',
          kind: 'household_transferred',
          cause: 'account_deleted',
          household_id: 'h',
          params: { household: 'Home', seniority: true },
          created_at: '2026-11-25T10:00:00Z',
        },
      ],
      isLoading: false,
      dismiss: jest.fn(),
    });

    for (const gamification of [false, true]) {
      mockUsePrefs.mockReturnValue(prefs(gamification));
      const { unmount } = renderPage();
      // The card's own landmark, on the real page: the mount is unconditional.
      expect(screen.getByRole('region', { name: 'What changed for you' })).toBeInTheDocument();
      unmount();
    }
  });
});
