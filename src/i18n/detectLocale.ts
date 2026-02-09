/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Utility: detectLocale
 *
 * AC-10.1.6: Browser Language Detection
 * - Detects browser language on first visit (no cookie set yet)
 * - Maps navigator.language to supported locale
 * - Sets NEXT_LOCALE cookie for subsequent visits
 * - Only runs once (first visit), then defers to cookie/profile
 */

import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from './config';

/**
 * Detects browser locale and sets NEXT_LOCALE cookie if not already set.
 * Should be called client-side on app mount.
 */
export function detectAndSetLocale(): SupportedLocale {
  // Check if cookie is already set
  const existingCookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('NEXT_LOCALE='));

  if (existingCookie) {
    const value = existingCookie.split('=')[1];
    if (value && SUPPORTED_LOCALES.includes(value as SupportedLocale)) {
      return value as SupportedLocale;
    }
  }

  // Detect from browser
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  const langPrefix = browserLang.split('-')[0]?.toLowerCase() || '';

  const detectedLocale: SupportedLocale = SUPPORTED_LOCALES.includes(langPrefix as SupportedLocale)
    ? (langPrefix as SupportedLocale)
    : DEFAULT_LOCALE;

  // Set cookie for server-side detection
  document.cookie = `NEXT_LOCALE=${detectedLocale};path=/;max-age=31536000;SameSite=Lax`;

  return detectedLocale;
}
