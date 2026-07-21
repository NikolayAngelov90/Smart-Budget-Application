/**
 * Tests for BudgetScoreRing Component — Story 15.2
 *
 * Progressive disclosure (null without data / hasData false), score + level
 * render, aria-label, factor breakdown with statuses and unscored hints.
 * Chakra renders hidden spans — query with queryByText/getByLabelText,
 * never container.firstChild null-checks (15-1 lesson).
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider, usePrefersReducedMotion } from '@chakra-ui/react';
import { BudgetScoreRing } from '@/components/dashboard/BudgetScoreRing';
import { useBudgetScore } from '@/lib/hooks/useBudgetScore';
import { useGamification } from '@/lib/hooks/useGamification';
import type { BudgetScore } from '@/types/database.types';

jest.mock('@/lib/hooks/useBudgetScore', () => ({
  useBudgetScore: jest.fn(),
  SCORE_KEY: '/api/gamification/score',
}));

// Story 15.8 (AC3): partial mock so the reduced-motion preference is spy-able
// while every other Chakra export (ChakraProvider, CircularProgress, …) stays real
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  usePrefersReducedMotion: jest.fn(() => false),
}));

// Story 15.6: the component (and useAchievementToast inside it) gates on the
// master toggle — mock explicitly so no real SWR runs under jest
jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'ariaLabel')
      return `Budget Score: ${params?.score} out of 100, level ${params?.level}`;
    const map: Record<string, string> = {
      breakdownTitle: 'What shapes your score',
      'levels.beginner': 'Beginner',
      'levels.building': 'Building',
      'levels.steady': 'Steady',
      'levels.strong': 'Strong',
      'levels.master': 'Master',
      'factors.adherence': 'Budget adherence',
      'factors.consistency': 'Logging consistency',
      'factors.goals': 'Goal progress',
      'status.helping': 'Helping',
      'status.hurting': 'Hurting',
      'status.neutral': 'Neutral',
      'status.unscored': 'Not scored yet',
      'hint.adherence': 'Set a category budget (or build spending history) to score this.',
      'hint.goals': 'Create a savings goal to score this.',
    };
    return map[key] ?? key;
  },
}));

const mockUseBudgetScore = useBudgetScore as jest.MockedFunction<typeof useBudgetScore>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;
const mockReducedMotion = usePrefersReducedMotion as jest.MockedFunction<typeof usePrefersReducedMotion>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

function makeScore(overrides: Partial<BudgetScore> = {}): BudgetScore {
  return {
    score: 72,
    level: 'steady',
    factors: [
      { key: 'adherence', earned: 40, max: 50, status: 'helping' },
      { key: 'consistency', earned: 10, max: 30, status: 'hurting' },
      { key: 'goals', earned: 0, max: 20, status: 'unscored' },
    ],
    ...overrides,
  };
}

const hookResult = (overrides: Partial<ReturnType<typeof useBudgetScore>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useBudgetScore>;

describe('BudgetScoreRing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-assert the enabled default: a disabled test's mockReturnValue would
    // otherwise leak into subsequent tests (clearAllMocks keeps return values)
    mockUseGamification.mockReturnValue({ enabled: true, isLoading: false });
  });

  it('renders nothing without data (progressive disclosure)', () => {
    mockUseBudgetScore.mockReturnValue(hookResult({}));
    renderWithChakra(<BudgetScoreRing />);
    expect(screen.queryByText('72')).not.toBeInTheDocument();
  });

  it('consults prefers-reduced-motion so the level-up pulse can be suppressed (Story 15.8, AC3)', () => {
    mockReducedMotion.mockReturnValue(true);
    mockUseBudgetScore.mockReturnValue(
      hookResult({ data: { hasData: true, budgetScore: makeScore() } })
    );
    renderWithChakra(<BudgetScoreRing />);
    // the component reads the reduced-motion preference in its render path;
    // the pulse is gated on `!prefersReducedMotion` (guarded in source)
    expect(mockReducedMotion).toHaveBeenCalled();
    expect(screen.getByText('72')).toBeInTheDocument();
    mockReducedMotion.mockReturnValue(false);
  });

  it('opted out: no ring AND no achievement toast, even with score + newlyUnlocked present (Story 15.6)', () => {
    // Gate disabled for the whole render lifecycle (effects included)
    mockUseGamification.mockReturnValue({ enabled: false, isLoading: false });
    mockUseBudgetScore.mockReturnValue(
      hookResult({
        data: {
          hasData: true,
          budgetScore: makeScore(),
          newlyUnlocked: ['week_streak'],
        } as never,
        // The newlyUnlocked scrub effect calls mutate(...).catch — must be thenable
        mutate: jest.fn().mockResolvedValue(undefined),
      })
    );
    renderWithChakra(<BudgetScoreRing />);

    expect(screen.queryByText('72')).not.toBeInTheDocument();
    // The newlyUnlocked effect runs but the gated toast hook must no-op
    expect(screen.queryByText('toastTitle')).not.toBeInTheDocument();
  });

  it('renders nothing when hasData is false', () => {
    mockUseBudgetScore.mockReturnValue(
      hookResult({ data: { hasData: false, budgetScore: null } })
    );
    renderWithChakra(<BudgetScoreRing />);
    expect(screen.queryByText(/Budget Score/)).not.toBeInTheDocument();
  });

  it('shows the score, level badge, and UX-mandated aria-label', () => {
    mockUseBudgetScore.mockReturnValue(
      hookResult({ data: { hasData: true, budgetScore: makeScore() } })
    );
    renderWithChakra(<BudgetScoreRing />);

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getAllByText('Steady').length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText('Budget Score: 72 out of 100, level Steady')
    ).toBeInTheDocument();
  });

  it('opens the factor breakdown with statuses on click', () => {
    mockUseBudgetScore.mockReturnValue(
      hookResult({ data: { hasData: true, budgetScore: makeScore() } })
    );
    renderWithChakra(<BudgetScoreRing />);

    fireEvent.click(screen.getByLabelText('Budget Score: 72 out of 100, level Steady'));

    expect(screen.getByText('What shapes your score')).toBeInTheDocument();
    expect(screen.getByText('Budget adherence')).toBeInTheDocument();
    expect(screen.getByText('Helping')).toBeInTheDocument();
    expect(screen.getByText('Logging consistency')).toBeInTheDocument();
    expect(screen.getByText('Hurting')).toBeInTheDocument();
    expect(screen.getByText('40/50')).toBeInTheDocument();
  });

  it('shows the unlock hint for unscored factors instead of points', () => {
    mockUseBudgetScore.mockReturnValue(
      hookResult({ data: { hasData: true, budgetScore: makeScore() } })
    );
    renderWithChakra(<BudgetScoreRing />);

    fireEvent.click(screen.getByLabelText('Budget Score: 72 out of 100, level Steady'));

    expect(screen.getByText('Not scored yet')).toBeInTheDocument();
    expect(screen.getByText('Create a savings goal to score this.')).toBeInTheDocument();
    expect(screen.queryByText('0/20')).not.toBeInTheDocument();
  });

  it('renders master level styling for a 100 score', () => {
    mockUseBudgetScore.mockReturnValue(
      hookResult({
        data: {
          hasData: true,
          budgetScore: makeScore({
            score: 100,
            level: 'master',
            factors: [
              { key: 'adherence', earned: 50, max: 50, status: 'helping' },
              { key: 'consistency', earned: 30, max: 30, status: 'helping' },
              { key: 'goals', earned: 20, max: 20, status: 'helping' },
            ],
          }),
        },
      })
    );
    renderWithChakra(<BudgetScoreRing />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('Master').length).toBeGreaterThan(0);
  });
});
