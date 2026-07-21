/**
 * useAchievementToast — Story 15.6 gating regression
 *
 * The toast callback is the single celebration point for BOTH call sites
 * (TransactionEntryModal + BudgetScoreRing). Opted-out users must get NO
 * achievement toasts; enabled users keep the existing behavior.
 */

import { renderHook } from '@testing-library/react';
import { useToast } from '@chakra-ui/react';
import { useAchievementToast } from '@/lib/hooks/useAchievementToast';
import { useGamification } from '@/lib/hooks/useGamification';

const mockToast = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useToast: jest.fn(() => mockToast),
}));

jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

describe('useAchievementToast — gamification gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue(mockToast);
  });

  it('fires a toast per key when gamification is enabled', () => {
    mockUseGamification.mockReturnValue({ enabled: true, isLoading: false });
    const { result } = renderHook(() => useAchievementToast());
    result.current(['week_streak', 'first_transaction'] as never);
    expect(mockToast).toHaveBeenCalledTimes(2);
  });

  it('no-ops entirely when gamification is opted out (Story 15.6)', () => {
    mockUseGamification.mockReturnValue({ enabled: false, isLoading: false });
    const { result } = renderHook(() => useAchievementToast());
    result.current(['week_streak', 'first_transaction'] as never);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('still no-ops on empty/undefined keys when enabled (pre-existing contract)', () => {
    mockUseGamification.mockReturnValue({ enabled: true, isLoading: false });
    const { result } = renderHook(() => useAchievementToast());
    result.current(undefined);
    result.current([] as never);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
