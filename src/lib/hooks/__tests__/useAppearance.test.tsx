/**
 * useAppearance — Story 16.5 appearance preference.
 *
 * Guards the behaviours that broke during development and in review:
 *  - a stored Light/Dark choice must SURVIVE a reload (an early version applied
 *    its 'system' placeholder before the stored value loaded, silently
 *    reverting the user's choice while it still sat in localStorage);
 *  - corrupted/absent storage falls back to 'system' instead of throwing;
 *  - 'system' resolves against the OS and follows live changes;
 *  - a missing matchMedia (old browsers / jsdom) must not crash.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import {
  useAppearance,
  readAppearance,
  resolveAppearance,
  isAppearance,
  APPEARANCE_KEY,
} from '@/lib/hooks/useAppearance';

const mockSetColorMode = jest.fn();
jest.mock('@chakra-ui/react', () => ({
  ...jest.requireActual('@chakra-ui/react'),
  useColorMode: () => ({ colorMode: 'light', setColorMode: mockSetColorMode }),
}));

/** Install a controllable matchMedia. */
function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  // jest.setup defines matchMedia as writable-but-not-configurable, so assign
  // rather than redefine.
  (window as unknown as { matchMedia: unknown }).matchMedia = jest
    .fn()
    .mockReturnValue(mql);
  return {
    fire(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

function Probe() {
  const { preference, setPreference } = useAppearance();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <button onClick={() => setPreference('dark')}>go-dark</button>
      <button onClick={() => setPreference('system')}>go-system</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <ChakraProvider>
      <Probe />
    </ChakraProvider>
  );

beforeEach(() => {
  mockSetColorMode.mockClear();
  localStorage.clear();
  mockMatchMedia(false);
});

describe('readAppearance / isAppearance / resolveAppearance', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readAppearance()).toBe('system');
  });

  it.each(['DARK', 'true', '{}', '', 'Light'])('falls back to system for garbage: %s', (v) => {
    localStorage.setItem(APPEARANCE_KEY, v);
    expect(readAppearance()).toBe('system');
  });

  it('accepts the three valid values', () => {
    for (const v of ['light', 'dark', 'system']) {
      localStorage.setItem(APPEARANCE_KEY, v);
      expect(readAppearance()).toBe(v);
      expect(isAppearance(v)).toBe(true);
    }
  });

  it('resolves system against the OS, and explicit choices as-is', () => {
    mockMatchMedia(true);
    expect(resolveAppearance('system')).toBe('dark');
    mockMatchMedia(false);
    expect(resolveAppearance('system')).toBe('light');
    expect(resolveAppearance('dark')).toBe('dark');
    expect(resolveAppearance('light')).toBe('light');
  });

  it('does not crash without matchMedia', () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    expect(() => resolveAppearance('system')).not.toThrow();
    expect(resolveAppearance('system')).toBe('light');
  });
});

describe('useAppearance', () => {
  it('APPLIES a stored dark preference on mount (does not revert to system)', () => {
    localStorage.setItem(APPEARANCE_KEY, 'dark');
    mockMatchMedia(false); // OS is light — the stored choice must still win

    renderProbe();

    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
    expect(mockSetColorMode).toHaveBeenCalledWith('dark');
    expect(mockSetColorMode).not.toHaveBeenCalledWith('light');
  });

  it('persists a new choice and applies it', () => {
    renderProbe();

    act(() => {
      screen.getByText('go-dark').click();
    });

    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    expect(screen.getByTestId('pref')).toHaveTextContent('dark');
    expect(mockSetColorMode).toHaveBeenLastCalledWith('dark');
  });

  it('follows live OS changes while on System', () => {
    localStorage.setItem(APPEARANCE_KEY, 'system');
    const media = mockMatchMedia(false);

    renderProbe();
    expect(mockSetColorMode).toHaveBeenLastCalledWith('light');

    act(() => media.fire(true));
    expect(mockSetColorMode).toHaveBeenLastCalledWith('dark');
  });

  it('does NOT follow the OS once an explicit choice is made', () => {
    localStorage.setItem(APPEARANCE_KEY, 'light');
    const media = mockMatchMedia(false);

    renderProbe();
    mockSetColorMode.mockClear();

    act(() => media.fire(true)); // OS goes dark; preference is explicit Light
    expect(mockSetColorMode).not.toHaveBeenCalledWith('dark');
  });
});
