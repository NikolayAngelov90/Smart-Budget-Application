/**
 * Contribution Service
 * Story 13.7: Income-Proportional Contribution Splits
 *
 * Members set a PERCENTAGE (never income). The shared-expense pot is divided into fair
 * shares from those percentages, and each member's actual contribution is tracked against
 * their fair share.
 *
 * - Writes (setting a percentage) use the service-role client because household_members is
 *   SELECT-only under RLS — but are always scoped to the caller's OWN row (`.eq('user_id')`)
 *   so a member can never change another's percentage (AC#4). Mirrors applyPreset (13.4).
 * - Reads go through the membership-gated household_contributions RPC (auth-scoped), which
 *   returns aggregates only.
 */

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';
import type {
  ContributionSummary,
  ContributionSplit,
  HouseholdContributionRow,
} from '@/types/database.types';

/**
 * Sets the caller's own contribution percentage (0–100).
 * @throws NotHouseholdMemberError if the caller has no household.
 * @throws Error on validation failure or a database error.
 */
export async function setContribution(userId: string, percentage: number): Promise<number> {
  const pct = Number(percentage);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('Contribution percentage must be between 0 and 100');
  }

  // Resolve the caller's household (auth-scoped read).
  const supabase = await createClient();
  const { data: membership, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) {
    logger.error('ContributionService', `membership lookup failed for ${userId}: ${memberError.message}`);
    throw new Error('Failed to load household membership');
  }
  if (!membership?.household_id) {
    throw new NotHouseholdMemberError();
  }

  // household_members is SELECT-only under RLS → write via service-role, own row only.
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('household_members')
    .update({ contribution_percentage: pct })
    .eq('user_id', userId);
  if (error) {
    logger.error('ContributionService', `setContribution failed for ${userId}: ${error.message}`);
    throw new Error('Failed to save contribution percentage');
  }
  return pct;
}

/**
 * Returns the household's contribution split: each member's percentage, fair share of the
 * shared pot, contributed amount, and progress. Fair shares are normalized by the sum of
 * percentages so they always reconcile to the total; with no percentages set, the pot is
 * split equally.
 */
export async function getContributionSummary(userId: string): Promise<ContributionSummary> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  const householdId = membership?.household_id ?? null;
  if (!householdId) {
    return { total: 0, splits: [] };
  }

  const { data, error } = await supabase.rpc('household_contributions', {
    p_household_id: householdId,
  });
  if (error) {
    logger.error('ContributionService', `household_contributions RPC failed: ${error.message}`);
    throw new Error('Failed to load contributions');
  }

  const rows = (data ?? []) as HouseholdContributionRow[];
  const total = rows.reduce((sum, r) => sum + Number(r.contributed), 0);
  const sumPct = rows.reduce((sum, r) => sum + Number(r.contribution_percentage ?? 0), 0);
  const memberCount = rows.length;

  const splits: ContributionSplit[] = rows.map((r) => {
    const pct = r.contribution_percentage == null ? null : Number(r.contribution_percentage);
    const contributed = Number(r.contributed);
    let fairShare: number;
    if (sumPct > 0) {
      fairShare = (Number(pct ?? 0) / sumPct) * total;
    } else {
      fairShare = memberCount > 0 ? total / memberCount : 0;
    }
    const progress = fairShare > 0 ? contributed / fairShare : 0;
    return {
      user_id: r.user_id,
      email: r.email,
      percentage: pct,
      contributed,
      fairShare,
      progress,
      isSelf: r.user_id === userId,
    };
  });

  return { total, splits };
}
