/**
 * Comeback Challenge Service — Story 15.4 (FR31)
 *
 * READS are auth-scoped (owner-only SELECT RLS exercised in prod). WRITES go
 * through the SERVICE-ROLE client after the route has authenticated the user
 * (Epic-13 house pattern: writes service-role, RLS SELECT-only) — the 15-4
 * review HIGH: INSERT/UPDATE grants let users forge instant-win challenges
 * via PostgREST, farming restores and fake Phoenix badges. The trust boundary
 * for challenge state is THIS service, not RLS.
 *
 * Progress is DERIVED from transactions.created_at (server-set logging-
 * activity time — never the user-editable `date`; catch-up entries of old
 * expenses SHOULD count: they are logging activity).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { TARGET_LOGS, WINDOW_DAYS, restoredStreak } from '@/lib/ai/comebackEngine';
import { restoreStreak } from '@/lib/services/streakService';
import { logger } from '@/lib/utils/logger';
import type { ComebackChallenge, ComebackCompletion, ComebackStatus } from '@/types/database.types';

const COLUMNS = 'id, started_at, expires_at, target_count, previous_streak, status, completed_at';

// comeback_challenges isn't in the typed Database schema (goals/user_achievements
// precedent) — use the generic client so .from() type-checks.
async function readClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

function writeClient(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The user's newest challenge regardless of status, or null */
export async function getLatestChallenge(userId: string): Promise<ComebackChallenge | null> {
  const supabase = await readClient();
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

/** The user's active challenge, or null */
export async function getActiveChallenge(userId: string): Promise<ComebackChallenge | null> {
  const supabase = await readClient();
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

/**
 * Creates the active challenge for the current absence (service-role write;
 * the caller has authenticated the user). `startedAtIso` lets the tx-POST
 * creation path anchor the window at the triggering transaction's created_at
 * so that log counts toward the target. The partial unique index (one active
 * per user) makes concurrent creation race-safe: the 23505 loser re-reads
 * the winner's row — never fabricates.
 */
export async function createChallenge(
  userId: string,
  previousStreak: number,
  startedAtIso?: string
): Promise<ComebackChallenge> {
  const supabase = writeClient();
  const startedMs = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
  const expiresAt = new Date(startedMs + WINDOW_DAYS * 86_400_000).toISOString();

  const insert: Record<string, unknown> = {
    user_id: userId,
    target_count: TARGET_LOGS,
    previous_streak: previousStreak,
    expires_at: expiresAt,
  };
  if (startedAtIso) insert.started_at = startedAtIso;

  const { data, error } = await supabase
    .from('comeback_challenges')
    .insert(insert)
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

/**
 * Transitions the ACTIVE challenge to a terminal status (service-role write).
 * Guarded with status='active' so terminal states never clobber each other
 * (15-4 review: lazy expiry racing completion, dismiss racing completion).
 * Returns true when this call won the transition.
 */
export async function markStatus(
  userId: string,
  challengeId: string,
  status: Exclude<ComebackStatus, 'active'>
): Promise<boolean> {
  const supabase = writeClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'completed') patch.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('comeback_challenges')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', challengeId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    logger.error('ComebackService', `markStatus failed: ${error.message}`);
    throw new Error('Failed to update comeback challenge');
  }
  return (data ?? []).length > 0;
}

/** Logging-activity count since the challenge started (created_at, server-set) */
export async function countLogsSince(userId: string, startedAtIso: string): Promise<number> {
  const supabase = await readClient();
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

/**
 * Shared completion path (tx POST + GET self-heal): when the active,
 * unexpired challenge has reached its target, RESTORE FIRST, then mark
 * completed. Ordering matters (15-4 review MED): if the restore fails the
 * challenge stays active and the next evaluation retries; if the mark fails
 * after a successful restore, the next evaluation re-restores idempotently
 * (max semantics) and re-marks. Returns null when there is nothing to
 * complete. Phoenix unlocking is the CALLER's job (the POST path awards it
 * through the signal-based evaluation so the toast rides the envelope).
 */
export async function completeChallengeIfEarned(
  userId: string,
  challenge: ComebackChallenge | null,
  currentStreak: number
): Promise<ComebackCompletion | null> {
  if (!challenge || challenge.status !== 'active') return null;
  if (new Date(challenge.expires_at).getTime() <= Date.now()) return null;

  const loggedCount = await countLogsSince(userId, challenge.started_at);
  if (loggedCount < challenge.target_count) return null;

  const restored = await restoreStreak(
    userId,
    restoredStreak(challenge.previous_streak, currentStreak)
  );
  await markStatus(userId, challenge.id, 'completed');
  return { completed: true, restoredStreak: restored };
}
