/**
 * Feature State Service — Story 15.7 (FR37, ADR-022)
 *
 * Reads and updates the caller's progressive-disclosure usage state. Purely
 * personal — every call uses the AUTH-SCOPED client so the owner-only RLS
 * (migration 011) is the security boundary and is exercised in production
 * (streakService / valuesService pattern). user_feature_state IS in the typed
 * Database schema, so no generic cast is needed.
 *
 * recordFeatureActivity is ENRICHMENT per the degradation policy
 * (docs/api-conventions.md#degradation-policy): callers treat failures as
 * non-fatal — a disclosure hiccup must never fail a transaction POST.
 */

import { createClient } from '@/lib/supabase/server';
import { isFeatureKey, type FeatureKey } from '@/lib/ai/disclosureCatalog';
import { logger } from '@/lib/utils/logger';

export interface FeatureState {
  transactions_count: number;
  days_active: number;
  features_unlocked: string[];
  last_active_date: string | null;
}

const DEFAULT_STATE: FeatureState = {
  transactions_count: 0,
  days_active: 0,
  features_unlocked: [],
  last_active_date: null,
};

const COLUMNS = 'transactions_count, days_active, features_unlocked, last_active_date';

/**
 * The caller's feature state, creating a zeroed row on first read. Some users
 * predate the signup insert (or it failed) — create-on-read is the backstop.
 */
export async function getFeatureState(userId: string): Promise<FeatureState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_feature_state')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('FeatureStateService', `get failed: ${error.message}`);
    throw new Error('Failed to load feature state');
  }

  if (data) {
    return {
      transactions_count: data.transactions_count,
      days_active: data.days_active,
      features_unlocked: data.features_unlocked ?? [],
      last_active_date: data.last_active_date,
    };
  }

  // Missing row — create the default (idempotent; a race just re-reads)
  const { error: insertError } = await supabase
    .from('user_feature_state')
    .insert({ user_id: userId });
  if (insertError && insertError.code !== '23505') {
    logger.error('FeatureStateService', `create failed: ${insertError.message}`);
    throw new Error('Failed to create feature state');
  }
  return { ...DEFAULT_STATE };
}

/**
 * Records one unit of activity: +1 transaction always, +1 day_active only when
 * this is a NEW calendar day (last_active_date < todayKey). ENRICHMENT —
 * callers wrap in .catch; never throws into the transaction path.
 *
 * Delegates to the atomic record_feature_activity RPC (migration 040): a single
 * UPSERT-increment, so concurrent tx POSTs can't lose increments (15-7 review),
 * and GREATEST() keeps last_active_date forward-only so a backdated log (the
 * ±1 resolveLogDay clamp) can't re-open a "new day" and farm days_active.
 *
 * days_active is a logging-days proxy: it counts days the user logged, not raw
 * app-opens (a user who never logs has no meaningful "active day" for feature
 * disclosure). This avoids a write on the cacheable GET read-path.
 *
 * @param todayKey yyyy-MM-dd (DATE-col compare rule — never new Date()/ISO).
 */
export async function recordFeatureActivity(
  userId: string,
  todayKey: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_feature_activity', { p_today: todayKey });

  if (error) {
    logger.error('FeatureStateService', `record failed: ${error.message}`);
    throw new Error('Failed to record feature activity');
  }
}

/**
 * Marks a feature as introduced (persists the acknowledgment). Idempotent —
 * appends only if absent. Rejects unknown keys: this is a REST-exposed write,
 * so the catalog is the trust boundary, not just the client (15-3 lesson).
 * Returns the updated features_unlocked array.
 */
export async function acknowledgeFeature(
  userId: string,
  featureKey: FeatureKey
): Promise<string[]> {
  if (!isFeatureKey(featureKey)) {
    throw new Error(`Unknown feature key: ${featureKey}`);
  }

  const state = await getFeatureState(userId);
  if (state.features_unlocked.includes(featureKey)) {
    return state.features_unlocked; // already acknowledged — no write
  }

  const next = [...state.features_unlocked, featureKey];
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_feature_state')
    .update({ features_unlocked: next })
    .eq('user_id', userId);

  if (error) {
    logger.error('FeatureStateService', `acknowledge failed: ${error.message}`);
    throw new Error('Failed to acknowledge feature');
  }
  return next;
}
