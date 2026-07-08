/**
 * Recovery Plan Service
 * Story 12.4 / FR4: 30-Day Budget Recovery Plans
 *
 * Orchestrates recovery-plan persistence and progress computation.
 * Follows the service-layer pattern: accepts the Supabase client as a
 * parameter (never creates its own). DB errors throw (never silently empty).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRecoveryPlanTargets } from '@/lib/ai/recoveryPlanner';
import { AVERAGE_WINDOW_MONTHS } from '@/lib/ai/spendingAnalysis';
import { toLocalISODate } from '@/lib/utils/date';
import type {
  Category,
  RecoveryPlan,
  RecoveryPlanProgress,
  RecoveryPlanResponse,
  RecoveryTarget,
  RecoveryTargetProgress,
  Transaction,
} from '@/types/database.types';

const PLAN_DAYS = 30;
const round2 = (n: number): number => Math.round(n * 100) / 100;

interface PlanDataset {
  currentMonthTransactions: Transaction[];
  historicalTransactions: Transaction[];
  categories: Category[];
}

/** Fetches the current-month + prior-3-month expense transactions and categories. */
async function fetchPlanDataset(
  supabase: SupabaseClient,
  userId: string,
  today: Date
): Promise<PlanDataset> {
  const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const currentMonthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const threeMonthsAgoDate = new Date(today.getFullYear(), today.getMonth() - AVERAGE_WINDOW_MONTHS, 1);
  const threeMonthsAgo = toLocalISODate(threeMonthsAgoDate);

  const [currentResult, historicalResult, categoriesResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', currentMonthStart)
      .lte('date', currentMonthEnd),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', threeMonthsAgo)
      .lt('date', currentMonthStart),
    supabase.from('categories').select('*').eq('user_id', userId),
  ]);

  if (currentResult.error) throw currentResult.error;
  if (historicalResult.error) throw historicalResult.error;
  if (categoriesResult.error) throw categoriesResult.error;

  return {
    currentMonthTransactions: (currentResult.data ?? []) as Transaction[],
    historicalTransactions: (historicalResult.data ?? []) as Transaction[],
    categories: (categoriesResult.data ?? []) as Category[],
  };
}

/** Computes progress for an active plan: actual spend per target since plan start. */
async function computeProgress(
  supabase: SupabaseClient,
  userId: string,
  plan: RecoveryPlan,
  today: Date
): Promise<RecoveryPlanProgress> {
  const startDate = new Date(`${plan.start_date}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  const rawElapsed = Math.floor((today.getTime() - startDate.getTime()) / msPerDay);
  const daysElapsed = Math.min(Math.max(rawElapsed, 0), PLAN_DAYS);
  const daysRemaining = Math.max(PLAN_DAYS - daysElapsed, 0);

  // Sum expense spend per category since plan start
  const { data: txData, error } = await supabase
    .from('transactions')
    .select('category_id, amount, type, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', plan.start_date)
    .lte('date', toLocalISODate(today));

  if (error) throw error;

  const spendByCategory = new Map<string, number>();
  for (const tx of (txData ?? []) as Array<{ category_id: string; amount: number }>) {
    spendByCategory.set(tx.category_id, (spendByCategory.get(tx.category_id) ?? 0) + tx.amount);
  }

  const categories: RecoveryTargetProgress[] = plan.targets.map((target: RecoveryTarget) => {
    const currentSpend = round2(spendByCategory.get(target.category_id) ?? 0);
    const proratedTarget = target.monthly_target * (daysElapsed / PLAN_DAYS);
    const onTrack = currentSpend <= proratedTarget;
    const pctOfTarget = target.monthly_target > 0 ? Math.round((currentSpend / target.monthly_target) * 100) : 0;
    return { ...target, current_spend: currentSpend, on_track: onTrack, pct_of_target: pctOfTarget };
  });

  return { plan, days_elapsed: daysElapsed, days_remaining: daysRemaining, categories };
}

/**
 * Returns the active plan with computed progress (or null), plus whether a
 * fresh plan could be generated from current data.
 */
export async function getActivePlanWithProgress(
  supabase: SupabaseClient,
  userId: string,
  today: Date = new Date()
): Promise<RecoveryPlanResponse> {
  const { data: planRow, error } = await supabase
    .from('recovery_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  // Determine whether overspent categories exist (can a plan be generated?)
  const dataset = await fetchPlanDataset(supabase, userId, today);
  const freshTargets = buildRecoveryPlanTargets(dataset);
  const canGenerate = freshTargets.length > 0;

  if (!planRow) {
    return { plan: null, canGenerate };
  }

  const plan = planRow as RecoveryPlan;

  // AC5: auto-complete a plan once it reaches its end date. The expired plan
  // stops being the active plan, freeing the recovery CTA to reappear if the
  // user is still overspending.
  if (plan.end_date < toLocalISODate(today)) {
    await updatePlanStatus(supabase, userId, plan.id, 'completed');
    return { plan: null, canGenerate };
  }

  const progress = await computeProgress(supabase, userId, plan, today);
  return { plan: progress, canGenerate };
}

/**
 * Generates and persists a new active recovery plan. Abandons any existing
 * active plan first (one active plan per user). Throws if nothing to recover.
 */
export async function generatePlan(
  supabase: SupabaseClient,
  userId: string,
  today: Date = new Date()
): Promise<RecoveryPlan> {
  const dataset = await fetchPlanDataset(supabase, userId, today);
  const targets = buildRecoveryPlanTargets(dataset);

  if (targets.length === 0) {
    throw new Error('No overspent categories — no recovery plan needed');
  }

  // Abandon any existing active plan
  const { error: abandonError } = await supabase
    .from('recovery_plans')
    .update({ status: 'abandoned' })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (abandonError) throw abandonError;

  const startDate = toLocalISODate(today);
  const endDate = toLocalISODate(new Date(today.getTime() + PLAN_DAYS * 24 * 60 * 60 * 1000));

  const { data: inserted, error: insertError } = await supabase
    .from('recovery_plans')
    .insert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      targets,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted as RecoveryPlan;
}

/** Updates a plan's status (abandoned/completed), scoped to the owner. */
export async function updatePlanStatus(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  status: 'abandoned' | 'completed'
): Promise<void> {
  const { error } = await supabase
    .from('recovery_plans')
    .update({ status })
    .eq('id', planId)
    .eq('user_id', userId);
  if (error) throw error;
}
