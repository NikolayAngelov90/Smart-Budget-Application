/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Shared i18n configuration constants
 *
 * This file contains locale constants that are shared between
 * server-side (request.ts) and client-side (detectLocale.ts) code.
 * It does NOT import next-intl to avoid ESM issues in tests.
 */

export const SUPPORTED_LOCALES = ['en', 'bg'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';
