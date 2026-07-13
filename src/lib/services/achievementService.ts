/**
 * Achievement Service — Story 15.3 (FR30)
 *
 * AUTH-SCOPED throughout: user_achievements is owner-only RLS (036), so the
 * policy is the gate and gets exercised in prod (allowanceService/valuesService
 * precedent). Append-only surface — reads and idempotent unlock inserts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ACHIEVEMENT_KEYS } from '@/lib/ai/achievementCatalog';
import { logger } from '@/lib/utils/logger';
import type { AchievementKey, UserAchievement } from '@/types/database.types';

// user_achievements isn't in the typed Database schema (goals precedent, 13-9
// gotcha) — use the generic client so .from('user_achievements') type-checks.
async function client(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** The caller's unlocked achievements, oldest first */
export async function getUnlocked(userId: string): Promise<UserAchievement[]> {
  const supabase = await client();

  const { data, error } = await supabase
    .from('user_achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: true });

  if (error) {
    logger.error('AchievementService', `get failed: ${error.message}`);
    throw new Error('Failed to load achievements');
  }
  return (data ?? []) as UserAchievement[];
}

/**
 * Persists unlocks idempotently and returns ONLY the rows actually inserted —
 * concurrent evaluation (tx POST racing score GET) can't double-unlock or
 * error: `ignoreDuplicates` rides the UNIQUE(user_id, achievement_key)
 * constraint, and losers of a race simply report nothing new.
 * Never reports unpersisted unlocks (15-1 lesson).
 */
export async function unlockAchievements(
  userId: string,
  keys: AchievementKey[]
): Promise<UserAchievement[]> {
  if (keys.length === 0) return [];
  const invalid = keys.filter((k) => !ACHIEVEMENT_KEYS.has(k));
  if (invalid.length > 0) {
    throw new Error(`Invalid achievement key(s): ${invalid.join(', ')}`);
  }

  const supabase = await client();

  const { data, error } = await supabase
    .from('user_achievements')
    .upsert(
      keys.map((achievement_key) => ({ user_id: userId, achievement_key })),
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true }
    )
    .select('achievement_key, unlocked_at');

  if (error) {
    logger.error('AchievementService', `unlock failed: ${error.message}`);
    throw new Error('Failed to unlock achievements');
  }
  return (data ?? []) as UserAchievement[];
}
