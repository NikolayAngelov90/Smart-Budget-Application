/**
 * Tests for StreakBadge Component — Story 15.1
 *
 * Progressive disclosure (null before first log / zero streak), streak display,
 * the auto-freeze feedback note, and the aria summary (15-8 groundwork).
 */

import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { useGamification } from '@/lib/hooks/useGamification';
import { useStreak } from '@/lib/hooks/useStreak';
import { localDayKey } from '@/lib/ai/streakEngine';
import type { StreakState } from '@/types/database.types';

jest.mock('@/lib/hooks/useStreak', () => ({
  useStreak: jest.fn(),
  STREAK_KEY: '/api/streaks',
}));

// Story 15.6: the component gates on the master gamification toggle — mock it
// explicitly (an unmocked useGamification would hit real SWR under jest)
jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
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
    if (key === 'longestLabel') return `Longest: ${params?.longest} days`;
    return map[key] ?? key;
  },
}));

const mockUseStreak = useStreak as jest.MockedFunction<typeof useStreak>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

const renderWithChakra = (ui: React.ReactElement) =>
  render(<ChakraProvider>{ui}</ChakraProvider>);

// Fixtures are CLOCK-RELATIVE: the badge now derives brokenness against the
// real today, so a hardcoded last_log_date would go stale and hide the badge.
function dayKeyAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDayKey(d);
}

function makeStreak(overrides: Partial<StreakState> = {}): StreakState {
  return {
    current_streak: 7,
    longest_streak: 12,
    weekly_streak: 3,
    last_log_date: dayKeyAgo(0),
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

  it('renders nothing when gamification is opted out — even with a live streak (Story 15.6)', () => {
    mockUseGamification.mockReturnValueOnce({ enabled: false, isLoading: false });
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: makeStreak() } }));
    renderWithChakra(<StreakBadge />);
    // Chakra renders hidden env spans — query for content, never emptiness (15-1)
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('renders nothing before the first log (progressive disclosure)', () => {
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: null } }));
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('exposes a polite live region carrying the streak summary (Story 15.8, AC2)', () => {
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: makeStreak() } }));
    const { container } = renderWithChakra(<StreakBadge />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    // the region announces the same summary the badge's aria-label carries
    expect(live?.textContent).toMatch(/Logging streak: 7 days/);
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
      screen.getByLabelText(/Logging streak: 7 days; 3 weeks; longest 12/)
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
    // Freeze stamps the MISSED day; the bridging log is one day later
    mockUseStreak.mockReturnValue(
      hookResult({
        data: { streak: makeStreak({ freeze_used_on: dayKeyAgo(1), last_log_date: dayKeyAgo(0) }) },
      })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.getByText(/Freeze used/)).toBeInTheDocument();
  });

  it('does NOT show the freeze note for an older freeze', () => {
    mockUseStreak.mockReturnValue(
      hookResult({
        data: { streak: makeStreak({ freeze_used_on: dayKeyAgo(12), last_log_date: dayKeyAgo(0) }) },
      })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/Freeze used/)).not.toBeInTheDocument();
  });

  it('hides a DEAD streak instead of showing a stale count as alive', () => {
    // Last log 10 days ago — no freeze can bridge that
    mockUseStreak.mockReturnValue(
      hookResult({ data: { streak: makeStreak({ last_log_date: dayKeyAgo(10) }) } })
    );
    renderWithChakra(<StreakBadge />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('is keyboard-focusable and exposes freeze status in the aria summary', () => {
    mockUseStreak.mockReturnValue(hookResult({ data: { streak: makeStreak() } }));
    renderWithChakra(<StreakBadge />);
    const badge = screen.getByLabelText(/A streak freeze is ready/);
    expect(badge).toHaveAttribute('tabindex', '0');
  });
});
