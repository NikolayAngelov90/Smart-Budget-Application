'use client';

/**
 * Appearance preference — Story 16.5
 *
 * Chakra's `colorMode` is binary (light | dark), but the user-facing choice is
 * three-way: Light / Dark / **System**. So the *preference* is stored here and
 * is the source of truth; Chakra's colour mode is the RESOLVED result of it.
 *
 * `smart-budget-appearance` holds the preference. The pre-hydration script in
 * `app/layout.tsx` reads the same key and mirrors the resolved value into
 * Chakra's own storage key + `<html data-theme>`, so the first paint is already
 * correct (no flash) and Chakra initialises in agreement with us.
 */

import { useCallback, useEffect, useState } from 'react';
import { useColorMode } from '@chakra-ui/react';

export type Appearance = 'light' | 'dark' | 'system';

export const APPEARANCE_KEY = 'smart-budget-appearance';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Read the stored preference; defaults to `system` (incl. SSR). */
export function readAppearance(): Appearance {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY);
    return isAppearance(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Resolve a preference to the concrete colour mode to apply. */
export function resolveAppearance(preference: Appearance): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function useAppearance() {
  const { setColorMode } = useColorMode();
  // Start from 'system' so server and first client render agree; the effect
  // below syncs to the stored value immediately after mount (the pre-hydration
  // script has already painted the right colours, so nothing flashes).
  const [preference, setPreferenceState] = useState<Appearance>('system');
  // Gate: until the stored preference is loaded, `preference` is still the
  // 'system' placeholder. Acting on it would resolve against the OS and
  // OVERWRITE a saved Light/Dark choice on every page load — the stored value
  // would survive in localStorage while the actual mode silently reverted.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferenceState(readAppearance());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    // Apply the (now real) preference.
    setColorMode(resolveAppearance(preference));

    // While on System, follow live OS changes — without this the user has to
    // reload to see the switch, which is the whole point of the System option.
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setColorMode(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [hydrated, preference, setColorMode]);

  const setPreference = useCallback(
    (next: Appearance) => {
      setPreferenceState(next);
      try {
        window.localStorage.setItem(APPEARANCE_KEY, next);
      } catch {
        // Private mode / storage disabled — the choice just won't persist.
      }
      setColorMode(resolveAppearance(next));
    },
    [setColorMode]
  );

  return { preference, setPreference };
}
