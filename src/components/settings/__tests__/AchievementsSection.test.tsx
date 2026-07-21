/**
 * Tests for AchievementsSection — Story 15.3
 *
 * Gallery shows ALL catalog entries (locked tiles are the motivation surface),
 * unlocked tiles carry the unlock date, aria labels distinguish states.
 * Chakra renders hidden spans — query with queryByText, never
 * container.firstChild null-checks (15-1 lesson).
 */

import { render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import { ChakraProvider } from '@chakra-ui/react';
import { AchievementsSection } from '@/components/settings/AchievementsSection';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useGamification } from '@/lib/hooks/useGamification';
import { ACHIEVEMENTS } from '@/lib/ai/achievementCatalog';

jest.mock('@/lib/hooks/useAchievements', () => ({
  useAchievements: jest.fn(),
  ACHIEVEMENTS_KEY: '/api/achievements',
}));

// Story 15.6: the component gates on the master gamification toggle — mock it
// explicitly (an unmocked useGamification would hit real SWR under jest)
jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'unlockedOn') return `Unlocked ${params?.date}`;
    if (key === 'heading') return 'Achievements';
    if (key === 'locked') return 'Locked';
    return key; // names.<key> / conditions.<key> pass through as identifiers
  },
}));

const mockUseAchievements = useAchievements as jest.MockedFunction<typeof useAchievements>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

const renderWithChakra = (ui: React.ReactElement) => render(<ChakraProvider>{ui}</ChakraProvider>);

const hookResult = (overrides: Partial<ReturnType<typeof useAchievements>>) =>
  ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useAchievements>;

describe('AchievementsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when gamification is opted out — unlocks preserved, gallery hidden (Story 15.6)', () => {
    mockUseGamification.mockReturnValueOnce({ enabled: false, isLoading: false });
    mockUseAchievements.mockReturnValue(
      hookResult({
        data: {
          achievements: [
            { achievement_key: 'first_transaction', unlocked_at: '2026-07-01T10:00:00Z' },
          ],
        },
      })
    );
    renderWithChakra(<AchievementsSection />);
    // Chakra renders hidden env spans — query for content, never emptiness (15-1)
    expect(screen.queryByText('Achievements')).not.toBeInTheDocument();
    expect(screen.queryByText('names.first_transaction')).not.toBeInTheDocument();
  });

  it('renders ALL catalog tiles even with no data (locked gallery is the motivation)', () => {
    mockUseAchievements.mockReturnValue(hookResult({}));
    renderWithChakra(<AchievementsSection />);

    for (const { key } of ACHIEVEMENTS) {
      expect(screen.getByText(`names.${key}`)).toBeInTheDocument();
      expect(screen.getByText(`conditions.${key}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Locked')).toHaveLength(ACHIEVEMENTS.length);
  });

  it('shows the unlock date on unlocked tiles and locked badges on the rest', () => {
    mockUseAchievements.mockReturnValue(
      hookResult({
        data: {
          achievements: [
            { achievement_key: 'first_transaction', unlocked_at: '2026-07-01T10:00:00Z' },
          ],
        },
      })
    );
    renderWithChakra(<AchievementsSection />);

    // Expectation computed through the SAME format path - literal strings
    // break on runners at extreme UTC offsets (15-3 review)
    const expectedDate = format(new Date('2026-07-01T10:00:00Z'), 'MMM d, yyyy');
    expect(screen.getByText(`Unlocked ${expectedDate}`)).toBeInTheDocument();
    expect(screen.getAllByText('Locked')).toHaveLength(ACHIEVEMENTS.length - 1);
    expect(
      screen.getByLabelText(`names.first_transaction, Unlocked ${expectedDate}`)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('names.week_streak, Locked')).toBeInTheDocument();
  });
});
