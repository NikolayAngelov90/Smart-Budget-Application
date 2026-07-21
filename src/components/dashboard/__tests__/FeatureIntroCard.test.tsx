/**
 * FeatureIntroCard tests — Story 15.7
 * Single highest-priority pending intro; dismiss persists + optimistically hides.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { FeatureIntroCard } from '@/components/dashboard/FeatureIntroCard';
import { useFeatureDisclosure } from '@/lib/hooks/useFeatureDisclosure';

jest.mock('@/lib/hooks/useFeatureDisclosure', () => ({
  useFeatureDisclosure: jest.fn(),
  DISCLOSURE_KEY: '/api/feature-disclosure',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      cardHeading: 'New feature unlocked',
      introCta: 'Check it out',
      introDismiss: 'Got it',
      'intro.heatmap': "You've logged 30 transactions — check out your Spending Heatmap.",
      'intro.projections': 'Two weeks of budgeting in — see your Budget Projections.',
      'intro.subscriptions': 'Enough history to spot recurring bills — review your Subscriptions.',
    };
    return map[key] ?? key;
  },
}));

const mockUse = useFeatureDisclosure as jest.MockedFunction<typeof useFeatureDisclosure>;

const hookResult = (over: Partial<ReturnType<typeof useFeatureDisclosure>>) =>
  ({
    unlocked: [],
    pending: [],
    isUnlocked: () => true,
    acknowledge: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
    mutate: jest.fn(),
    ...over,
  }) as ReturnType<typeof useFeatureDisclosure>;

const renderCard = () => render(<ChakraProvider><FeatureIntroCard /></ChakraProvider>);

describe('FeatureIntroCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when nothing is pending', () => {
    mockUse.mockReturnValue(hookResult({ pending: [] }));
    renderCard();
    expect(screen.queryByText('New feature unlocked')).not.toBeInTheDocument();
  });

  it('shows the single highest-priority pending intro (subscriptions@50 over heatmap@30)', () => {
    mockUse.mockReturnValue(hookResult({ pending: ['heatmap', 'subscriptions'] }));
    renderCard();
    expect(
      screen.getByText('Enough history to spot recurring bills — review your Subscriptions.')
    ).toBeInTheDocument();
    // only ONE intro at a time — the heatmap copy is not shown
    expect(
      screen.queryByText("You've logged 30 transactions — check out your Spending Heatmap.")
    ).not.toBeInTheDocument();
  });

  it('dismiss calls acknowledge for the shown feature and optimistically hides it', () => {
    const acknowledge = jest.fn().mockResolvedValue(undefined);
    mockUse.mockReturnValue(hookResult({ pending: ['heatmap'], acknowledge }));
    renderCard();

    expect(screen.getByText("You've logged 30 transactions — check out your Spending Heatmap.")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Got it'));

    expect(acknowledge).toHaveBeenCalledWith('heatmap');
    // optimistic hide
    expect(
      screen.queryByText("You've logged 30 transactions — check out your Spending Heatmap.")
    ).not.toBeInTheDocument();
  });
});
