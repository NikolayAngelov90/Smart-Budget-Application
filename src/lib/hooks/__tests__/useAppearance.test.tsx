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
 *
 * The pure functions live in useAppearance.pure.test.tsx, in their own file so
 * they get their own module registry: `sessionPreference` is module-level state
 * that `localStorage.clear()` cannot reset, and this file sets it. See that
 * file's header for the measurements.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { useAppearance, readAppearance, APPEARANCE_KEY } from '@/lib/hooks/useAppearance';

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
  (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue(mql);
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

  it('invalid storage falls back to the SESSION choice, not to system', async () => {
    // THE PATH THAT WAS NOT COVERED. `useAppearance.storage.test.tsx` already
    // covers the session fallback when storage THROWS (private mode, blocked
    // site data) — and its comment notes the fresh-module-registry point. What
    // nothing covered is storage that reads fine and holds an INVALID value,
    // which is the case the old pure-function tests claimed to be about.
    //
    // `readAppearance()` is:
    //
    //   valid stored value  ->  it
    //   otherwise           ->  sessionPreference ?? 'system'
    //
    // The old `falls back to system for garbage: X` tests asserted the
    // unconditional claim and passed only because they were declared before any
    // setPreference call, so `sessionPreference` was still null. Under
    // --randomize they failed with Expected "system", Received "dark" — the
    // session value leaking in, exactly as the code says it should.
    //
    // This is deliberate product behaviour, documented at the declaration: when
    // localStorage is unavailable (private mode, quota) the user's click must
    // still take effect for the session. So the fallback is right and the old
    // test name was wrong, which is the sort of thing a green does not reveal.
    renderProbe();

    await act(async () => {
      screen.getByText('go-dark').click();
    });

    // Storage now holds a VALID value, so corrupt it and re-read.
    localStorage.setItem(APPEARANCE_KEY, 'not-an-appearance');
    expect(readAppearance()).toBe('dark');

    // And with storage empty rather than corrupt, the session still wins.
    localStorage.clear();
    expect(readAppearance()).toBe('dark');
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
