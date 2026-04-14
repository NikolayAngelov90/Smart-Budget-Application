/**
 * Subscription Detection Service
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * Detects recurring charges from transaction history, flags unused subscriptions,
 * and provides CRUD operations for detected subscriptions.
 *
 * Uses ADR-014 (detected_subscriptions table) and ADR-019 (Vercel Cron).
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { differenceInDays, subMonths } from 'date-fns';
import { logger } from '@/lib/utils/logger';
import { toLocalISODate } from '@/lib/utils/date';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DetectedSubscription,
  DetectedSubscriptionInsert,
  SubscriptionFrequency,
  SubscriptionStatus,
  Transaction,
} from '@/types/database.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Frequency interval ranges in days for classification */
const FREQUENCY_RANGES: Record<SubscriptionFrequency, { min: number; max: number; nominal: number }> = {
  weekly: { min: 5, max: 9, nominal: 7 },
  monthly: { min: 25, max: 35, nominal: 30 },
  quarterly: { min: 80, max: 100, nominal: 90 },
  annual: { min: 340, max: 395, nominal: 365 },
};

/** Minimum transactions to consider a pattern a subscription */
const MIN_TRANSACTIONS_FOR_DETECTION = 3;

/** Amount tolerance for matching (±10%) */
const AMOUNT_TOLERANCE = 0.10;

/** Unused threshold: flag if overdue by >1.5x the frequency interval */
const UNUSED_MULTIPLIER = 1.5;

/** Minimum consistency ratio for pattern detection (>60% of intervals must match) */
const MIN_CONSISTENCY_RATIO = 0.6;

// ============================================================================
// MERCHANT NORMALIZATION
// ============================================================================

/**
 * Normalize a merchant name for pattern matching.
 * Strips common suffixes, lowercases, trims whitespace.
 */
export function normalizeMerchant(notes: string): string {
  return notes
    .toLowerCase()
    .trim()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|s\.?a\.?|plc)\b\.?/gi, '')
    .replace(/\.(com|net|org|io)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// FREQUENCY DETECTION
// ============================================================================

/**
 * Classify the subscription frequency based on median interval between transactions.
 * Returns null if no consistent frequency pattern is found.
 */
export function classifyFrequency(
  intervals: number[]
): SubscriptionFrequency | null {
  if (intervals.length === 0) return null;

  // Sort and take median (length already checked > 0 above)
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] as number;

  for (const [freq, range] of Object.entries(FREQUENCY_RANGES)) {
    if (median >= range.min && median <= range.max) {
      // Check consistency: >60% of intervals should fall in range
      const matchingCount = intervals.filter(
        (i) => i >= range.min && i <= range.max
      ).length;
      const ratio = matchingCount / intervals.length;

      if (ratio >= MIN_CONSISTENCY_RATIO) {
        return freq as SubscriptionFrequency;
      }
    }
  }

  return null;
}

/**
 * Check if two amounts are within the tolerance threshold (±10%).
 */
export function amountsMatch(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const reference = Math.max(a, b);
  return Math.abs(a - b) / reference <= AMOUNT_TOLERANCE;
}

// ============================================================================
// CORE DETECTION
// ============================================================================

interface MerchantGroup {
  merchant: string;
  transactions: Array<{ amount: number; date: string; currency: string }>;
}

/**
 * Group transactions by normalized merchant name.
 * Only includes expense transactions with notes (merchant info).
 */
function groupByMerchant(
  transactions: Transaction[]
): Map<string, MerchantGroup> {
  const groups = new Map<string, MerchantGroup>();

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.notes) continue;

    const normalized = normalizeMerchant(tx.notes);
    if (!normalized) continue;

    const existing = groups.get(normalized);
    if (existing) {
      existing.transactions.push({ amount: tx.amount, date: tx.date, currency: tx.currency });
    } else {
      groups.set(normalized, {
        merchant: normalized,
        transactions: [{ amount: tx.amount, date: tx.date, currency: tx.currency }],
      });
    }
  }

  return groups;
}

/**
 * Detect subscriptions from a user's transaction history.
 * Analyzes 3-6 months of expense transactions for recurring patterns.
 */
export async function detectSubscriptions(
  userId: string
): Promise<DetectedSubscriptionInsert[]> {
  const supabase = createServiceRoleClient();
  const sixMonthsAgo = toLocalISODate(subMonths(new Date(), 6));

  // Query expense transactions for the last 6 months
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', sixMonthsAgo)
    .order('date', { ascending: true });

  if (error) {
    logger.error('SubscriptionService', `Error fetching transactions for user ${userId}:`, error);
    throw error;
  }

  if (!transactions || transactions.length === 0) {
    return [];
  }

  const merchantGroups = groupByMerchant(transactions);
  const detected: DetectedSubscriptionInsert[] = [];

  for (const [, group] of merchantGroups) {
    // Need minimum transactions for detection
    if (group.transactions.length < MIN_TRANSACTIONS_FOR_DETECTION) continue;

    // Sort by date ascending
    const sorted = [...group.transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i]!;
      const prev = sorted[i - 1]!;
      intervals.push(differenceInDays(new Date(curr.date), new Date(prev.date)));
    }

    // Check amount consistency: use median amount
    const amounts = sorted.map((t) => t.amount);
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)] as number;

    // Verify amounts are within tolerance of median
    const consistentAmounts = amounts.filter((a) =>
      amountsMatch(a, medianAmount)
    );
    if (consistentAmounts.length / amounts.length < MIN_CONSISTENCY_RATIO) {
      continue;
    }

    // Classify frequency
    const frequency = classifyFrequency(intervals);
    if (!frequency) continue;

    const lastTransaction = sorted[sorted.length - 1]!;

    detected.push({
      user_id: userId,
      merchant_pattern: group.merchant,
      estimated_amount: medianAmount,
      currency: lastTransaction.currency,
      frequency,
      last_seen_at: new Date(lastTransaction.date).toISOString(),
      status: 'active',
    });
  }

  // Upsert detected subscriptions (update existing, insert new)
  for (const sub of detected) {
    const { data: existing } = await supabase
      .from('detected_subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .eq('merchant_pattern', sub.merchant_pattern)
      .maybeSingle();

    if (existing) {
      // Only update if not dismissed or kept by user
      if (existing.status === 'active' || existing.status === 'unused') {
        await supabase
          .from('detected_subscriptions')
          .update({
            estimated_amount: sub.estimated_amount,
            currency: sub.currency,
            frequency: sub.frequency,
            last_seen_at: sub.last_seen_at,
            status: 'active',
          })
          .eq('id', existing.id);
      }
    } else {
      await supabase
        .from('detected_subscriptions')
        .insert(sub);
    }
  }

  return detected;
}

/**
 * Flag subscriptions as unused if their expected next charge is overdue
 * by more than 1.5x the frequency interval.
 */
export async function flagUnusedSubscriptions(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const now = new Date();

  const { data: subscriptions, error } = await supabase
    .from('detected_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    logger.error('SubscriptionService', `Error fetching subscriptions for user ${userId}:`, error);
    throw error;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return 0;
  }

  let flaggedCount = 0;

  for (const sub of subscriptions) {
    const range = FREQUENCY_RANGES[sub.frequency];
    const daysSinceLastSeen = differenceInDays(now, new Date(sub.last_seen_at));
    const overdueThreshold = range.nominal * UNUSED_MULTIPLIER;

    if (daysSinceLastSeen > overdueThreshold) {
      await supabase
        .from('detected_subscriptions')
        .update({ status: 'unused' as SubscriptionStatus })
        .eq('id', sub.id);
      flaggedCount++;
    }
  }

  return flaggedCount;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all detected subscriptions for a user, sorted by status then amount.
 * Accepts a Supabase client to enforce RLS in user-facing contexts.
 */
export async function getSubscriptionsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<DetectedSubscription[]> {

  const { data, error } = await supabase
    .from('detected_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'unused', 'kept'])
    .order('status', { ascending: true })
    .order('estimated_amount', { ascending: false });

  if (error) {
    logger.error('SubscriptionService', `Error fetching subscriptions:`, error);
    throw error;
  }

  return data || [];
}

/**
 * Update a subscription's status (dismiss or keep).
 * Returns the updated subscription or null if not found.
 * Accepts a Supabase client to enforce RLS in user-facing contexts.
 */
export async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
  subscriptionId: string,
  status: 'dismissed' | 'kept'
): Promise<DetectedSubscription | null> {

  // Verify subscription belongs to user
  const { data: existing, error: fetchError } = await supabase
    .from('detected_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logger.error('SubscriptionService', `Error fetching subscription:`, fetchError);
    throw fetchError;
  }

  if (!existing) {
    return null;
  }

  const { data, error } = await supabase
    .from('detected_subscriptions')
    .update({ status })
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    logger.error('SubscriptionService', `Error updating subscription:`, error);
    throw error;
  }

  return data;
}

/**
 * Check if a user has enough transaction history for subscription detection.
 * Returns true if user has transactions spanning 3+ months.
 */
export async function hasEnoughHistory(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const threeMonthsAgo = toLocalISODate(subMonths(new Date(), 3));

  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .lte('date', threeMonthsAgo)
    .limit(1);

  if (error) {
    logger.error('SubscriptionService', `Error checking history:`, error);
    throw error;
  }

  return (data?.length ?? 0) > 0;
}

// Re-export constants for testing
export { FREQUENCY_RANGES, MIN_TRANSACTIONS_FOR_DETECTION, AMOUNT_TOLERANCE, UNUSED_MULTIPLIER };
