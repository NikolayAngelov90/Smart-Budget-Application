/**
 * Allowance Service
 * Story 13.6: Personal Allowance System
 *
 * A personal allowance is a PRIVATE budget within a household. Privacy is enforced at
 * the data layer (migration 024):
 * - `personal_allowances` has OWNER-ONLY RLS (no household member OR-branch), so the
 *   amount is invisible to other members.
 * - Allowance transactions carry household_id = NULL (forced server-side in the
 *   transactions route), keeping them owner-only and out of shared totals.
 *
 * Because RLS is owner-only for every op, this service uses the AUTH-SCOPED client for
 * both reads and writes — the privacy policy is exercised in the real production path
 * rather than bypassed with the service role.
 */

import { createClient } from '@/lib/supabase/server';
import { NotHouseholdMemberError } from '@/lib/services/householdService';
import { logger } from '@/lib/utils/logger';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/utils/constants';
import type { PersonalAllowance, AllowanceStatus } from '@/types/database.types';

export interface UpsertAllowanceInput {
  monthly_amount: number;
  currency?: string;
}

/** First day of the current month as an ISO date string (YYYY-MM-01). */
function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Returns the caller's personal allowance, or null if none is configured.
 * Auth-scoped: RLS guarantees only the owner ever sees the row.
 */
export async function getAllowance(userId: string): Promise<PersonalAllowance | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('personal_allowances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('AllowanceService', `getAllowance failed for ${userId}: ${error.message}`);
    throw new Error('Failed to load allowance');
  }
  return (data as PersonalAllowance | null) ?? null;
}

/**
 * Creates or updates the caller's single allowance for their household.
 * @throws NotHouseholdMemberError if the caller has no household (allowance lives within one).
 * @throws Error on validation failure or a database error.
 */
export async function upsertAllowance(
  userId: string,
  input: UpsertAllowanceInput
): Promise<PersonalAllowance> {
  const amount = Number(input.monthly_amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Allowance amount must be a non-negative number');
  }
  const currency = input.currency && (SUPPORTED_CURRENCIES as readonly string[]).includes(input.currency)
    ? input.currency
    : DEFAULT_CURRENCY;

  const supabase = await createClient();

  // The allowance is a budget WITHIN a household — resolve the caller's membership.
  const { data: membership, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (memberError) {
    logger.error('AllowanceService', `membership lookup failed for ${userId}: ${memberError.message}`);
    throw new Error('Failed to load household membership');
  }
  if (!membership?.household_id) {
    throw new NotHouseholdMemberError();
  }

  // Upsert on the (user_id, household_id) unique key.
  const { data, error } = await supabase
    .from('personal_allowances')
    .upsert(
      {
        user_id: userId,
        household_id: membership.household_id,
        monthly_amount: amount,
        currency,
      },
      { onConflict: 'user_id,household_id' }
    )
    .select()
    .single();

  if (error || !data) {
    logger.error('AllowanceService', `upsertAllowance failed for ${userId}: ${error?.message}`);
    throw new Error('Failed to save allowance');
  }
  return data as PersonalAllowance;
}

/**
 * Returns the allowance plus the current month's spend and remaining balance.
 * `spent` sums the caller's current-month EXPENSE transactions tagged to the allowance.
 */
export async function getAllowanceStatus(userId: string): Promise<AllowanceStatus> {
  const allowance = await getAllowance(userId);
  if (!allowance) {
    return { allowance: null, spent: 0, remaining: null };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('allowance_id', allowance.id)
    .eq('type', 'expense')
    .gte('date', currentMonthStart());

  if (error) {
    logger.error('AllowanceService', `allowance spend query failed for ${userId}: ${error.message}`);
    throw new Error('Failed to load allowance spend');
  }

  const spent = (rows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  return { allowance, spent, remaining: allowance.monthly_amount - spent };
}

/** Deletes the caller's allowance (owner-only via RLS). Tagged transactions are kept. */
export async function deleteAllowance(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('personal_allowances')
    .delete()
    .eq('user_id', userId);
  if (error) {
    logger.error('AllowanceService', `deleteAllowance failed for ${userId}: ${error.message}`);
    throw new Error('Failed to delete allowance');
  }
}
