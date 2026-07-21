/**
 * Story 15.6 — hook-level fetch gating
 *
 * The four gamification data hooks must pass a NULL SWR key while opted out
 * (no fetch, no cache write) and their real KEY while enabled. Asserting the
 * exact key argument (not just "some falsy value") keeps the contract from
 * silently vanishing (15-5 arg-blind-mock lesson).
 */

import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { useGamification } from '@/lib/hooks/useGamification';
import { useStreak, STREAK_KEY } from '@/lib/hooks/useStreak';
import { useBudgetScore, SCORE_KEY } from '@/lib/hooks/useBudgetScore';
import { useComeback, COMEBACK_KEY } from '@/lib/hooks/useComeback';
import { useAchievements, ACHIEVEMENTS_KEY } from '@/lib/hooks/useAchievements';

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })),
}));

jest.mock('@/lib/hooks/useGamification', () => ({
  useGamification: jest.fn(() => ({ enabled: true, isLoading: false })),
}));

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

const cases: Array<[string, () => unknown, string]> = [
  ['useStreak', () => renderHook(() => useStreak()), STREAK_KEY],
  ['useBudgetScore', () => renderHook(() => useBudgetScore()), SCORE_KEY],
  ['useComeback', () => renderHook(() => useComeback()), COMEBACK_KEY],
  ['useAchievements', () => renderHook(() => useAchievements()), ACHIEVEMENTS_KEY],
];

describe('gamification fetch gating (Story 15.6)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe.each(cases)('%s', (_name, run, key) => {
    it(`passes ${key} when gamification is enabled`, () => {
      mockUseGamification.mockReturnValue({ enabled: true, isLoading: false });
      run();
      expect(mockUseSWR).toHaveBeenCalledWith(key, expect.any(Function), expect.any(Object));
    });

    it('passes null (no fetch) when gamification is opted out', () => {
      mockUseGamification.mockReturnValue({ enabled: false, isLoading: false });
      run();
      expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object));
    });
  });
});
