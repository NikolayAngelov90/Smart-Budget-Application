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
 *
 * The preference lives in a tiny external store rather than per-component state
 * so that every mount agrees, and a change in ANOTHER TAB propagates here.
 * `<AppearanceSync/>` (mounted in `Providers`) applies it app-wide — without a
 * root-level mount the System listener would only exist on whichever screen
 * happened to render the control.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useColorMode } from '@chakra-ui/react';

export type Appearance = 'light' | 'dark' | 'system';

export const APPEARANCE_KEY = 'smart-budget-appearance';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Session override. When localStorage is unavailable (private mode, quota) the
 * write silently fails — without this the snapshot would re-read empty storage
 * and the user's click would appear to do nothing at all. The choice then
 * applies for the session and simply doesn't survive a reload.
 */
let sessionPreference: Appearance | null = null;

/** Read the stored preference; defaults to `system` (incl. SSR). */
export function readAppearance(): Appearance {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY);
    if (isAppearance(stored)) return stored;
  } catch {
    // fall through to the session value
  }
  return sessionPreference ?? 'system';
}

/** Resolve a preference to the concrete colour mode to apply. */
export function resolveAppearance(preference: Appearance): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

// ── external store ─────────────────────────────────────────────────────────
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Cross-tab: a change written by another tab must land here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== APPEARANCE_KEY) return;
    sessionPreference = null; // another tab's stored value is authoritative
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// The server and the FIRST client render must agree, so the snapshot is only
// read from storage on the client; SSR always reports 'system'.
const getServerSnapshot = (): Appearance => 'system';

/** Keeps the browser-chrome colour in step with the applied mode. */
function syncThemeColorMeta(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  // `themeColor` metadata keys off prefers-color-scheme, but the app keys off
  // the STORED preference — so OS-light + "Dark" left a bright address bar
  // around a dark app. Rewriting the tag keeps them in step.
  const color = mode === 'dark' ? '#111008' : '#F6F5F2';
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((tag) => {
      tag.removeAttribute('media');
      tag.setAttribute('content', color);
    });
}

export function useAppearance() {
  const { setColorMode } = useColorMode();
  const preference = useSyncExternalStore(subscribe, readAppearance, getServerSnapshot);

  // Apply the preference, and while on System follow live OS changes — without
  // this the user would have to reload to see the switch, which is the whole
  // point of the System option.
  useEffect(() => {
    const apply = (mode: 'light' | 'dark') => {
      setColorMode(mode);
      syncThemeColorMeta(mode);
    };

    apply(resolveAppearance(preference));

    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => apply(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference, setColorMode]);

  const setPreference = useCallback((next: Appearance) => {
    sessionPreference = next;
    try {
      window.localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      // Private mode / quota — the choice applies for this session but won't persist.
    }
    notify();
  }, []);

  return { preference, setPreference };
}

/**
 * Mounts the appearance effects once at the app root so System tracking (and
 * the theme-colour sync) work on EVERY screen, not just wherever the Settings
 * control happens to be rendered. Renders nothing.
 */
export function AppearanceSync() {
  useAppearance();
  return null;
}
