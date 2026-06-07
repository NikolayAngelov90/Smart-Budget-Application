/**
 * Savings Transaction Service
 * Story 13.9 (revised decision): contributing to a savings goal also logs an EXPENSE
 * transaction in a "Savings" category, so the money shows as leaving the budget and is
 * reflected in spending/dashboard views.
 *
 * The transaction is the contributor's own personal expense (household_id NULL) linked to
 * the goal contribution via goal_contribution_id. Accepts the Supabase client as a
 * parameter: the personal-goal path passes an auth-scoped client (RLS permits the user's
 * own category + transaction); the shared-goal path passes the service-role client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

const SAVINGS_CATEGORY_NAME = 'Savings';
const SAVINGS_CATEGORY_COLOR = '#38a169'; // green — money set aside

export interface LogSavingsInput {
  userId: string;
  amount: number;
  goalName: string;
  goalContributionId: string;
  currency: string;
}

/** Today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resolves the user's "Savings" expense category id, creating it if it doesn't exist.
 */
async function resolveSavingsCategoryId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', SAVINGS_CATEGORY_NAME)
    .eq('type', 'expense')
    .maybeSingle();
  if (findError) {
    logger.error('SavingsTransaction', `Savings category lookup failed: ${findError.message}`);
    throw new Error('Failed to resolve savings category');
  }
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: SAVINGS_CATEGORY_NAME,
      color: SAVINGS_CATEGORY_COLOR,
      type: 'expense',
      is_predefined: false,
    })
    .select('id')
    .single();
  if (createError || !created) {
    logger.error('SavingsTransaction', `Savings category create failed: ${createError?.message}`);
    throw new Error('Failed to create savings category');
  }
  return created.id;
}

/**
 * Logs a "Savings" expense transaction for a goal contribution. Linked to the contribution
 * via goal_contribution_id (ON DELETE SET NULL — the expense survives if the contribution
 * is later removed). Throws on failure so the caller can decide how to handle it.
 */
export async function logSavingsContribution(
  supabase: SupabaseClient,
  input: LogSavingsInput
): Promise<void> {
  const categoryId = await resolveSavingsCategoryId(supabase, input.userId);

  const { error } = await supabase.from('transactions').insert({
    user_id: input.userId,
    category_id: categoryId,
    amount: input.amount,
    type: 'expense',
    date: today(),
    notes: `Savings: ${input.goalName}`.slice(0, 100),
    currency: input.currency,
    household_id: null,
    goal_contribution_id: input.goalContributionId,
  });
  if (error) {
    logger.error('SavingsTransaction', `Savings transaction insert failed: ${error.message}`);
    throw new Error('Failed to log savings transaction');
  }
}
