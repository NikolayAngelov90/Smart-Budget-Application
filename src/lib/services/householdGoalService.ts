/**
 * Household Goal Service
 * Story 13.9: Shared Household Savings Goals
 *
 * Shared savings goals = a `goals` row with household_id set. Members can READ shared goals
 * (dual-path SELECT RLS); create/contribute go through the service-role client with an
 * explicit is_household_member check (Epic-13 pattern: household writes service-role,
 * RLS SELECT-only). Per-member breakdown comes from the membership-gated
 * household_goal_breakdown aggregate (sums only).
 *
 * Contributions also log a "Savings" expense for the contributor (revised decision).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logSavingsContribution } from '@/lib/services/savingsTransactionService';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { logger } from '@/lib/utils/logger';
import { DEFAULT_CURRENCY } from '@/lib/utils/constants';
import type {
  Goal,
  HouseholdGoal,
  HouseholdGoalWithBreakdown,
  GoalMemberBreakdown,
  CreateHouseholdGoalInput,
  AddContributionInput,
} from '@/types/database.types';

/** Goal not found / not a shared goal in the caller's household. → 404 */
export class GoalNotFoundError extends Error {
  constructor(message = 'Goal not found') {
    super(message);
    this.name = 'GoalNotFoundError';
  }
}

async function resolveHouseholdId(userId: string): Promise<string | null> {
  // goals / goal_contributions aren't in the typed Database schema (like goalService) —
  // use the generic client so .from('goals') type-checks.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.error('HouseholdGoalService', `membership lookup failed: ${error.message}`);
    throw new Error('Failed to load household membership');
  }
  return data?.household_id ?? null;
}

async function resolveCurrency(userId: string): Promise<string> {
  // goals / goal_contributions aren't in the typed Database schema (like goalService) —
  // use the generic client so .from('goals') type-checks.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data } = await supabase.from('user_profiles').select('preferences').eq('id', userId).maybeSingle();
  const prefs = (data?.preferences ?? {}) as { currency_format?: unknown };
  return typeof prefs.currency_format === 'string' ? prefs.currency_format : DEFAULT_CURRENCY;
}

/**
 * Lists the caller's household's shared goals, each with its per-member breakdown.
 * Auth-scoped reads (RLS dual-path SELECT returns shared goals to members).
 */
export async function getHouseholdGoals(userId: string): Promise<HouseholdGoalWithBreakdown[]> {
  const householdId = await resolveHouseholdId(userId);
  if (!householdId) return [];

  // goals / goal_contributions aren't in the typed Database schema (like goalService) —
  // use the generic client so .from('goals') type-checks.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('HouseholdGoalService', `list goals failed: ${error.message}`);
    throw new Error('Failed to load household goals');
  }

  const result: HouseholdGoalWithBreakdown[] = [];
  for (const goal of (goals ?? []) as HouseholdGoal[]) {
    const { data: breakdown, error: rpcError } = await supabase.rpc('household_goal_breakdown', {
      p_goal_id: goal.id,
    });
    if (rpcError) {
      logger.error('HouseholdGoalService', `breakdown RPC failed for ${goal.id}: ${rpcError.message}`);
      throw new Error('Failed to load goal breakdown');
    }
    result.push({ goal, breakdown: (breakdown ?? []) as GoalMemberBreakdown[] });
  }
  return result;
}

/**
 * Creates a shared goal in the caller's household (service-role; membership-gated).
 * @throws NotHouseholdMemberError if the caller has no household.
 */
export async function createHouseholdGoal(userId: string, input: CreateHouseholdGoalInput): Promise<HouseholdGoal> {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('Goal name is required');
  const target = Number(input.target_amount);
  if (!Number.isFinite(target) || target <= 0) throw new Error('Target amount must be greater than 0');

  const householdId = await resolveHouseholdId(userId);
  if (!householdId) throw new NotHouseholdMemberError();

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from('goals')
    .insert({ user_id: userId, household_id: householdId, name, target_amount: target, deadline: input.deadline ?? null })
    .select()
    .single();
  if (error || !data) {
    logger.error('HouseholdGoalService', `create goal failed: ${error?.message}`);
    throw new Error('Failed to create household goal');
  }
  return data as HouseholdGoal;
}

/**
 * Records a member's contribution to a shared goal, logs their Savings expense, and
 * recomputes the goal's accumulated total (authoritative SUM — concurrency-safe).
 * @throws NotHouseholdMemberError | GoalNotFoundError
 */
export async function contributeToHouseholdGoal(
  userId: string,
  goalId: string,
  input: AddContributionInput
): Promise<Goal> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Contribution amount must be greater than 0');

  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  // The goal must exist and be shared; the caller must belong to its household.
  const { data: goal, error: goalError } = await admin
    .from('goals')
    .select('id, name, household_id, target_amount')
    .eq('id', goalId)
    .maybeSingle();
  if (goalError) {
    logger.error('HouseholdGoalService', `goal lookup failed: ${goalError.message}`);
    throw new Error('Failed to load goal');
  }
  if (!goal || !goal.household_id) throw new GoalNotFoundError();

  const { data: membership } = await admin
    .from('household_members')
    .select('id')
    .eq('user_id', userId)
    .eq('household_id', goal.household_id)
    .maybeSingle();
  if (!membership) throw new NotHouseholdMemberError();

  // Insert the contribution (capture id to link the Savings expense).
  const { data: contribution, error: contribError } = await admin
    .from('goal_contributions')
    .insert({ goal_id: goalId, user_id: userId, amount, note: input.note ?? null })
    .select('id')
    .single();
  if (contribError || !contribution) {
    logger.error('HouseholdGoalService', `contribution insert failed: ${contribError?.message}`);
    throw new Error('Failed to record contribution');
  }

  // Log the contributor's Savings expense (best-effort — never lose the contribution).
  try {
    const currency = await resolveCurrency(userId);
    await logSavingsContribution(admin, {
      userId,
      amount,
      goalName: goal.name,
      goalContributionId: contribution.id,
      currency,
    });
  } catch (savingsError) {
    logger.error('HouseholdGoalService', 'Savings expense logging failed (non-fatal):', savingsError);
  }

  // Recompute current_amount = SUM(contributions) — authoritative across concurrent members.
  const { data: sumRows, error: sumError } = await admin
    .from('goal_contributions')
    .select('amount')
    .eq('goal_id', goalId);
  if (sumError) {
    logger.error('HouseholdGoalService', `sum query failed: ${sumError.message}`);
    throw new Error('Failed to total contributions');
  }
  const total = (sumRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  const { data: updated, error: updateError } = await admin
    .from('goals')
    .update({ current_amount: total })
    .eq('id', goalId)
    .select()
    .single();
  if (updateError || !updated) {
    logger.error('HouseholdGoalService', `goal update failed: ${updateError?.message}`);
    throw new Error('Failed to update goal total');
  }

  // Story 15.5 (UX Journey 5): milestone crossed → push the OTHER members
  // (the contributor sees the in-app celebration). Best-effort, never fails
  // the contribution; the gate owns the 'household' toggle + quiet hours.
  try {
    const target = Number((goal as { target_amount?: number }).target_amount ?? 0);
    if (target > 0) {
      const beforePct = ((total - amount) / target) * 100;
      const afterPct = (total / target) * 100;
      // Same thresholds as the client goal celebration (milestones_celebrated).
      // EPSILON on the before-side: float subtraction can re-derive 24.999…
      // for a total that already sat exactly on a milestone and re-fire it.
      // Known accepted gap: two CONCURRENT contributions whose post-insert
      // SUMs both see the crossing can each push it — cosmetic, ms-window,
      // pushes are best-effort (an atomic claim needs a sent-marker design).
      const EPS = 1e-9;
      const crossed = [25, 50, 75, 100].filter((m) => beforePct < m - EPS && afterPct >= m);
      if (crossed.length > 0) {
        const milestone = crossed[crossed.length - 1];
        const { data: members, error: rosterError } = await admin
          .from('household_members')
          .select('user_id')
          .eq('household_id', goal.household_id)
          .neq('user_id', userId);
        if (rosterError) {
          // Supabase returns errors as values — without this log a failed
          // roster read would silently push no one
          logger.warn('HouseholdGoalService', `milestone roster read failed: ${rosterError.message}`);
        }
        await Promise.allSettled(
          (members ?? []).map((m: { user_id: string }) =>
            dispatchCategorizedPush(m.user_id, 'household', {
              type: 'milestone',
              title: `${milestone}% reached!`,
              body: `"${goal.name}" just passed ${milestone}% of its target.`,
              data: { url: '/household' },
            })
          )
        );
      }
    }
  } catch (pushError) {
    logger.error('HouseholdGoalService', 'Milestone push failed (non-fatal):', pushError);
  }

  return updated as Goal;
}
