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

jest.mock('@/lib/hooks/useComeback', () => ({
  useComeback: jest.fn(),
  COMEBACK_KEY: '/api/comeback',
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

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

const CHALLENGE = {
  id: 'ch-1',
  started_at: '2026-07-13T08:00:00Z',
  expires_at: '2026-07-20T08:00:00Z',
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
});
