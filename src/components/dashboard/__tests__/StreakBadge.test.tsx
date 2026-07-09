/**
 * Tests for StreakBadge Component — Story 15.1
 *
 * Progressive disclosure (null before first log / zero streak), streak display,
 * the auto-freeze feedback note, and the aria summary (15-8 groundwork).
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { useStreak } from '@/lib/hooks/useStreak';
import type { StreakState } from '@/types/database.types';

jest.mock('@/lib/hooks/useStreak', () => ({
  useStreak: jest.fn(),
  STREAK_KEY: '/api/streaks',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'dayStreak') return `${params?.days}-day streak`;
    if (key === 'weekStreak') return `${params?.weeks} weeks`;
    if (key === 'ariaSummary')
      return `Logging streak: ${params?.days} days; ${params?.weeks} weeks; longest ${params?.longest}`;
    const map: Record<string, string> = {
      freezeUsed: 'Streak freeze used — your streak is safe.',
      freezeUsedShort: 'Freeze used',
      freezeAvailable: 'A streak freeze is ready.',
      freezeSpent: "This week's freeze is used.",
    };
    return map[key] ?? key;
  },
}));

const mockUseStreak = useStreak as jest.MockedFunction<typeof useStreak>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

function makeStreak(overrides: Partial<StreakState> = {}): StreakState {
  return {
    current_streak: 7,
    longest_streak: 12,
    weekly_streak: 3,
    last_log_date: '2026-07-02',
    last_log_week: '2026-W27',
    freeze_used_on: null,
    ...overrides,
  };
}

const hookResult = (overrides: Partial<ReturnType<typeof useStreak>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useStreak>;

describe('StreakBadge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing before the first log (progressive disclosure)', () => {
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: null } }));
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('renders nothing while loading with no cached data', () => {
    mockUseStreak.mockReturnValue(hookResult({ isLoading: true }));
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('renders nothing for a zero streak', () => {
    mockUseStreak.mockReturnValue(
      hookResult({ data: { streak: makeStreak({ current_streak: 0 }) } })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('shows the daily streak with weekly context and an aria summary', () => {
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: makeStreak() } }));
    renderWithChakra(<StreakBadge />);

    expect(screen.getByText('7-day streak')).toBeInTheDocument();
    expect(screen.getByText('3 weeks')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Logging streak: 7 days; 3 weeks; longest 12')
    ).toBeInTheDocument();
  });

  it('hides the weekly count when it is not yet meaningful (1 week)', () => {
    mockUseStreak.mockReturnValue(
      hookResult({ data: { streak: makeStreak({ weekly_streak: 1 }) } })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText('1 weeks')).not.toBeInTheDocument();
  });

  it('shows the freeze-used note when the last advance consumed the freeze', () => {
    mockUseStreak.mockReturnValue(
      hookResult({
        data: { streak: makeStreak({ freeze_used_on: '2026-07-02', last_log_date: '2026-07-02' }) },
      })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.getByText(/Freeze used/)).toBeInTheDocument();
  });

  it('does NOT show the freeze note for an older freeze', () => {
    mockUseStreak.mockReturnValue(
      hookResult({
        data: { streak: makeStreak({ freeze_used_on: '2026-06-20', last_log_date: '2026-07-02' }) },
      })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/Freeze used/)).not.toBeInTheDocument();
  });
});
