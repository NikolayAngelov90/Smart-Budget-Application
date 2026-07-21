/**
 * useGamification — Story 15.6 (FR33)
 *
 * The single client gamification gate: absent flag = enabled (opt-OUT model),
 * explicit false = disabled. Wraps useUserPreferences (no new fetch path).
 */

import { renderHook } from '@testing-library/react';
import { useGamification } from '@/lib/hooks/useGamification';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import type { UserPreferences } from '@/types/user.types';

jest.mock('@/lib/hooks/useUserPreferences', () => ({
  useUserPreferences: jest.fn(),
}));

const mockUsePrefs = useUserPreferences as jest.MockedFunction<typeof useUserPreferences>;

const prefs = (overrides: Partial<UserPreferences> = {}): UserPreferences =>
  ({
    currency_format: 'EUR',
    date_format: 'MM/DD/YYYY',
    onboarding_completed: true,
    language: 'en',
    ...overrides,
  }) as UserPreferences;

describe('useGamification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to enabled when the flag is absent (opt-out model)', () => {
    mockUsePrefs.mockReturnValue({ preferences: prefs(), isLoading: false, error: undefined });
    const { result } = renderHook(() => useGamification());
    expect(result.current.enabled).toBe(true);
  });

  it('defaults to enabled while the profile is still loading (preferences null)', () => {
    mockUsePrefs.mockReturnValue({ preferences: null, isLoading: true, error: undefined });
    const { result } = renderHook(() => useGamification());
    expect(result.current.enabled).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it('disabled ONLY on an explicit false', () => {
    mockUsePrefs.mockReturnValue({
      preferences: prefs({ gamification_enabled: false }),
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useGamification());
    expect(result.current.enabled).toBe(false);
  });

  it('explicit true stays enabled', () => {
    mockUsePrefs.mockReturnValue({
      preferences: prefs({ gamification_enabled: true }),
      isLoading: false,
      error: undefined,
    });
    const { result } = renderHook(() => useGamification());
    expect(result.current.enabled).toBe(true);
  });
});
