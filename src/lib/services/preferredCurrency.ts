/**
 * The currency a response should be denominated in — DW-1.
 *
 * Read from the profile SERVER-side rather than taken from a query parameter.
 * The bug this story fixes is a label asserting something the numbers do not
 * support, so the value used to CONVERT and the value used to LABEL have to be
 * the same one. A client-supplied parameter can be stale by exactly one
 * preference change, which is the skew that produced the original mismatch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

/**
 * Matches the app-wide default in `UserPreferences`. This IS the constant the
 * lint rule tells callers to use instead of a literal, so it has to be spelled
 * out exactly once — here.
 */
// eslint-disable-next-line no-restricted-syntax
export const DEFAULT_CURRENCY = 'EUR';

export async function resolvePreferredCurrency(
  // The routes hold differently-typed clients; only `.from()` is needed here.
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const preferences = (data?.preferences ?? {}) as { currency_format?: string };
    return (preferences.currency_format ?? DEFAULT_CURRENCY).toUpperCase();
  } catch (e) {
    // Enrichment, not a core input: falling back to the default is the same
    // behaviour these routes had before they converted at all.
    logger.warn('PreferredCurrency', 'Falling back to the default currency:', e);
    return DEFAULT_CURRENCY;
  }
}
