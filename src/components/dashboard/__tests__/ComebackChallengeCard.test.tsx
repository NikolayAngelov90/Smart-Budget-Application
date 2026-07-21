/**
 * Tests for ComebackChallengeCard — Story 15.4
 *
 * Null gates, progress render, dismiss PATCH, no-guilt copy surface.
 * Chakra renders hidden spans — queryByText, never container.firstChild (15-1).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { ComebackChallengeCard } from '@/components/dashboard/ComebackChallengeCard';
import { useComeback } from '@/lib/hooks/useComeback';
import { useGamification } from '@/lib/hooks/useGamification';

jest.mock('@/lib/hooks/useComeback', () => ({
  useComeback: jest.fn(),
  COMEBACK_KEY: '/api/comeback',
}));

// Story 15.6: the component gates on the master gamification toggle — mock it
// explicitly (an unmocked useGamification would hit real SWR under jest)
jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      heading: 'Welcome back! 🔥',
      dismiss: 'Not now',
    };
    if (key === 'body') return `Log ${params?.target} transactions this week to reignite your streak.`;
    if (key === 'progress') return `${params?.count} of ${params?.target} logged`;
    if (key === 'restorePromise') return `Finish to bring back ${params?.days} days of your streak.`;
    return map[key] ?? key;
  },
}));

const mockUseComeback = useComeback as jest.MockedFunction<typeof useComeback>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

// CLOCK-RELATIVE (15-1 lesson): the card derives expiry against the real
// Date.now(), so hardcoded timestamps rot — the original fixture expired on
// 2026-07-20 and started failing the moment the suite ran after that date.
const CHALLENGE = {
  id: 'ch-1',
  started_at: new Date(Date.now() - 86_400_000).toISOString(),
  expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  target_count: 3,
  previous_streak: 12,
  status: 'active' as const,
  completed_at: null,
};

const hookResult = (overrides: Partial<ReturnType<typeof useComeback>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ReturnType<typeof useComeback>;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
});

describe('ComebackChallengeCard', () => {
  it('renders nothing when gamification is opted out — even with an active challenge (Story 15.6)', () => {
    mockUseGamification.mockReturnValueOnce({ enabled: false, isLoading: false });
    mockUseComeback.mockReturnValue(hookResult({ data: { challenge: CHALLENGE, loggedCount: 1 } }));
    renderWithChakra(<ComebackChallengeCard />);
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it('renders nothing without an active challenge', () => {
    mockUseComeback.mockReturnValue(hookResult({ data: { challenge: null, loggedCount: 0 } }));
    renderWithChakra(<ComebackChallengeCard />);
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it('renders nothing for a dismissed challenge', () => {
    mockUseComeback.mockReturnValue(
      hookResult({ data: { challenge: { ...CHALLENGE, status: 'dismissed' }, loggedCount: 1 } })
    );
    renderWithChakra(<ComebackChallengeCard />);
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it('shows the challenge, progress, and the guaranteed restore floor', () => {
    mockUseComeback.mockReturnValue(
      hookResult({ data: { challenge: CHALLENGE, loggedCount: 2 } })
    );
    renderWithChakra(<ComebackChallengeCard />);

    expect(screen.getByText('Welcome back! 🔥')).toBeInTheDocument();
    expect(
      screen.getByText('Log 3 transactions this week to reignite your streak.')
    ).toBeInTheDocument();
    expect(screen.getByText('2 of 3 logged')).toBeInTheDocument();
    // floor(12 × 0.5) = 6
    expect(screen.getByText('Finish to bring back 6 days of your streak.')).toBeInTheDocument();
  });

  it('renders nothing for an already-expired challenge (dashboard left open across expiry)', () => {
    mockUseComeback.mockReturnValue(
      hookResult({
        data: {
          challenge: { ...CHALLENGE, expires_at: new Date(Date.now() - 1000).toISOString() },
          loggedCount: 2,
        },
      })
    );
    renderWithChakra(<ComebackChallengeCard />);
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it('exposes the card and progress via aria labels', () => {
    mockUseComeback.mockReturnValue(
      hookResult({ data: { challenge: CHALLENGE, loggedCount: 1 } })
    );
    renderWithChakra(<ComebackChallengeCard />);

    expect(screen.getByLabelText('Welcome back! 🔥')).toBeInTheDocument(); // section
    expect(screen.getByLabelText('1 of 3 logged')).toBeInTheDocument(); // Progress bar
  });

  it('dismiss PATCHes and hides optimistically', async () => {
    mockUseComeback.mockReturnValue(
      hookResult({ data: { challenge: CHALLENGE, loggedCount: 0 } })
    );
    renderWithChakra(<ComebackChallengeCard />);

    fireEvent.click(screen.getByText('Not now'));

    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument(); // optimistic
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/comeback',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'dismiss' }) })
      );
    });
  });

  it('un-hides when the dismiss PATCH fails so the user can retry', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    mockUseComeback.mockReturnValue(
      hookResult({ data: { challenge: CHALLENGE, loggedCount: 0 } })
    );
    renderWithChakra(<ComebackChallengeCard />);

    fireEvent.click(screen.getByText('Not now'));
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/)).toBeInTheDocument(); // rolled back
    });
  });
});
