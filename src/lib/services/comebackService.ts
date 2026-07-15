/**
 * Comeback Challenge Service — Story 15.4 (FR31)
 *
 * AUTH-SCOPED throughout: comeback_challenges is owner-only RLS (037), the
 * policy is the gate and gets exercised in prod (house precedent). Progress is
 * DERIVED from transactions.created_at (server-set logging-activity time —
 * never the user-editable `date`, which would invite backdating; and catch-up
 * entries of old expenses SHOULD count: they are logging activity).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { TARGET_LOGS, WINDOW_DAYS } from '@/lib/ai/comebackEngine';
import { logger } from '@/lib/utils/logger';
import type { ComebackChallenge, ComebackStatus } from '@/types/database.types';

const COLUMNS = 'id, started_at, expires_at, target_count, previous_streak, status, completed_at';

// comeback_challenges isn't in the typed Database schema (goals/user_achievements
// precedent) — use the generic client so .from() type-checks.
async function client(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** The user's newest challenge regardless of status, or null */
export async function getLatestChallenge(userId: string): Promise<ComebackChallenge | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from('comeback_challenges')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('ComebackService', `get failed: ${error.message}`);
    throw new Error('Failed to load comeback challenge');
  }
  return (data as ComebackChallenge | null) ?? null;
}

/**
 * Creates the active challenge for the current absence. The partial unique
 * index (one active per user) makes concurrent create-on-read GETs safe:
 * the 23505 loser re-reads the winner's row — never fabricates.
 */
export async function createChallenge(
  userId: string,
  previousStreak: number
): Promise<ComebackChallenge> {
  const supabase = await client();
  const expiresAt = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('comeback_challenges')
    .insert({
      user_id: userId,
      target_count: TARGET_LOGS,
      previous_streak: previousStreak,
      expires_at: expiresAt,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      const raced = await getActiveChallenge(userId);
      if (raced) return raced;
    }
    logger.error('ComebackService', `create failed: ${error.message}`);
    throw new Error('Failed to create comeback challenge');
  }
  return data as ComebackChallenge;
}

/** The user's active challenge, or null */
export async function getActiveChallenge(userId: string): Promise<ComebackChallenge | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from('comeback_challenges')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    logger.error('ComebackService', `get active failed: ${error.message}`);
    throw new Error('Failed to load comeback challenge');
  }
  return (data as ComebackChallenge | null) ?? null;
}

/** Transitions a challenge's status (own row); completed also stamps completed_at */
export async function markStatus(
  userId: string,
  challengeId: string,
  status: Exclude<ComebackStatus, 'active'>
): Promise<void> {
  const supabase = await client();
  const patch: Record<string, unknown> = { status };
  if (status === 'completed') patch.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('comeback_challenges')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', challengeId);

  if (error) {
    logger.error('ComebackService', `markStatus failed: ${error.message}`);
    throw new Error('Failed to update comeback challenge');
  }
}

/** Logging-activity count since the challenge started (created_at, server-set) */
export async function countLogsSince(userId: string, startedAtIso: string): Promise<number> {
  const supabase = await client();
  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startedAtIso);

  if (error) {
    logger.error('ComebackService', `count failed: ${error.message}`);
    throw new Error('Failed to count challenge progress');
  }
  return count ?? 0;
}
