/**
 * Goal Service
 * Story 11.5: Savings Goals
 *
 * CRUD operations for savings goals and contributions.
 *
 * Architecture compliance:
 * - All functions accept supabase client as parameter (NEVER create their own) — M1 from 11.2
 * - DB errors throw (never silently return empty) — M4 from 11.2
 * - No ! non-null assertions — optional chaining used throughout
 * - Ownership enforced via double .eq('user_id', userId) even with RLS
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  AddContributionInput,
} from '@/types/database.types';

/** PostgREST "no rows found" error code */
const PGRST116 = 'PGRST116';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns all goals for a user, ordered by created_at descending.
 * @throws on DB error
 */
export async function getGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Returns a single goal by ID for the given user, or null if not found.
 * @throws on DB error (except "row not found" which returns null)
 */
export async function getGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === PGRST116) return null;
    throw error;
  }
  return data;
}

/**
 * Creates a new savings goal.
 * @throws on DB error
 */
export async function createGoal(
  supabase: SupabaseClient,
  userId: string,
  input: CreateGoalInput
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name: input.name,
      target_amount: input.target_amount,
      deadline: input.deadline ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Goal creation returned no data');
  return data;
}

/**
 * Updates an existing goal. Only provided fields are changed.
 * @throws on DB error or if goal not found/not owned by user
 */
export async function updateGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  updates: UpdateGoalInput
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === PGRST116) throw new Error('Goal not found');
    throw error;
  }
  if (!data) throw new Error('Goal update returned no data');
  return data;
}

/**
 * Deletes a goal and all its contributions (via CASCADE).
 * @throws on DB error
 */
export async function deleteGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Adds a contribution to a goal and increments current_amount.
 *
 * Two-step operation: INSERT contribution → re-fetch current → UPDATE goal amount.
 * Not atomic (no RPC), but acceptable for single-user scope.
 *
 * @throws on DB error at any step
 */
export async function addContribution(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  input: AddContributionInput
): Promise<Goal> {
  // Step 1: Insert contribution record
  const { error: contribError } = await supabase
    .from('goal_contributions')
    .insert({
      goal_id: goalId,
      user_id: userId,
      amount: input.amount,
      note: input.note ?? null,
    });

  if (contribError) throw contribError;

  // Step 2: Fetch current goal amount
  const { data: current, error: fetchError } = await supabase
    .from('goals')
    .select('current_amount')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    if (fetchError.code === PGRST116) throw new Error('Goal not found');
    throw fetchError;
  }
  if (!current) throw new Error('Goal not found after contribution insert');

  // Step 3: Increment current_amount.
  // NOTE: If this UPDATE fails after the INSERT above succeeded, the contribution
  // record persists but current_amount is not updated (data inconsistency).
  // Acceptable for single-user scope; no rollback is attempted.
  const newAmount = Number(current.current_amount) + Number(input.amount);
  const { data: updated, error: updateError } = await supabase
    .from('goals')
    .update({ current_amount: newAmount })
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError) throw updateError;
  if (!updated) throw new Error('Goal update returned no data');
  return updated;
}
