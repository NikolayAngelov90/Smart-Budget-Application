/**
 * Input Sanitization Utilities
 * Story 11.2: Security Headers & Input Sanitization
 *
 * Provides sanitization functions for user input used in database queries
 * to prevent Supabase filter injection and other input-based attacks.
 */

/**
 * Maximum allowed length for search queries
 */
const MAX_SEARCH_LENGTH = 100;

/**
 * Sanitize a search query for use in Supabase .or() / .ilike() filter strings.
 *
 * Supabase PostgREST filter strings use dots, commas, and percent signs as
 * metacharacters. Unsanitized user input can manipulate the filter clause.
 *
 * This function:
 * - Truncates to MAX_SEARCH_LENGTH characters
 * - Escapes backslashes (must be first)
 * - Escapes percent signs (wildcard in ILIKE)
 * - Escapes underscores (single-char wildcard in ILIKE)
 * - Removes commas (PostgREST OR separator in .or() filters)
 * - Removes dots followed by keywords (PostgREST operator separator)
 *
 * @param query - Raw user search input
 * @returns Sanitized string safe for use in Supabase filter interpolation
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/%/g, '\\%')       // Escape ILIKE wildcards
    .replace(/_/g, '\\_')       // Escape ILIKE single-char wildcards
    .replace(/,/g, '')          // Remove commas (PostgREST OR separator)
    .replace(/\./g, '')         // Remove dots (PostgREST operator separator)
    .trim();
}
