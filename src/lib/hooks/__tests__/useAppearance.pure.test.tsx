/**
 * useAppearance — the PURE functions, in their own file on purpose.
 *
 * WHY THEY ARE NOT IN useAppearance.test.tsx ANY MORE.
 *
 * `readAppearance()` falls back through module-level state:
 *
 *   const stored = localStorage.getItem(APPEARANCE_KEY);
 *   if (isAppearance(stored)) return stored;
 *   return sessionPreference ?? 'system';     // <- module-level `let`
 *
 * `sessionPreference` is set by `setPreference` and **cannot be cleared from
 * outside the module** — `localStorage.clear()` does not touch it. So once any
 * test in the same file has called `setPreference('dark')`, every later
 * `readAppearance()` with empty or invalid storage returns `'dark'`.
 *
 * In the combined file these tests passed only because they were DECLARED
 * BEFORE the hook tests that call `setPreference`. Under `--randomize` six of
 * them failed with `Expected: "system", Received: "dark"` at seeds 2 and 4, and
 * passed at 1 and 3. Every one of them passes run individually, so the problem
 * was never the assertions.
 *
 * Jest gives each test FILE its own module registry, so splitting them is what
 * actually removes the dependency: `sessionPreference` starts as `null` here and
 * nothing in this file ever sets it. A `beforeEach` could not have fixed it, and
 * `jest.resetModules()` would have desynchronised the statically-imported hook
 * from the dynamically re-imported functions.
 *
 * THE CONTRACT THESE TESTS NAME IS NARROWER THAN THEIR OLD NAMES SUGGESTED, and
 * the real one is now asserted in useAppearance.test.tsx: invalid storage falls
 * back to the SESSION preference when one has been set, and only to 'system'
 * when none has. The old green never established the unconditional claim.
 */

import {
  readAppearance,
  resolveAppearance,
  isAppearance,
  APPEARANCE_KEY,
} from '@/lib/hooks/useAppearance';

/** Install a controllable matchMedia. */
function mockMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  // jest.setup defines matchMedia as writable-but-not-configurable, so assign
  // rather than redefine.
  (window as unknown as { matchMedia: unknown }).matchMedia = jest.fn().mockReturnValue(mql);
}

beforeEach(() => {
  localStorage.clear();
  mockMatchMedia(false);
});

describe('readAppearance / isAppearance / resolveAppearance', () => {
  it('defaults to system when nothing is stored AND no session choice was made', () => {
    // The precondition is now in the name. It used to be supplied by declaration
    // order, which is not a precondition, it is a coincidence.
    expect(readAppearance()).toBe('system');
  });

  it.each(['DARK', 'true', '{}', '', 'Light'])(
    'falls back to system for garbage: %s (no session choice)',
    (v) => {
      localStorage.setItem(APPEARANCE_KEY, v);
      expect(readAppearance()).toBe('system');
    }
  );

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
