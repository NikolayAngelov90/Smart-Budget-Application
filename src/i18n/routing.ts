/**
 * i18n Routing Configuration
 * Story 10-1: i18n Framework Setup & Language Switcher
 *
 * This app uses a non-routing approach (no locale prefix in URLs).
 * Locale is determined by:
 * 1. User preference stored in Supabase (persisted)
 * 2. NEXT_LOCALE cookie (for SSR before preferences load)
 * 3. Browser navigator.language detection (first visit only)
 * 4. Default: 'en'
 */

export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';
export type { SupportedLocale } from './config';
