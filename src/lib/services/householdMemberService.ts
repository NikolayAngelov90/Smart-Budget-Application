/**
 * Household Member Service
 * Story 13.11: Member Removal & Access Revocation
 *
 * - listHouseholdMembers: membership-gated roster (auth-scoped RPC) for the admin UI.
 * - removeMember: admin-only DELETE of the household_members row (service-role). That single
 *   delete revokes ALL shared access — the ex-member instantly fails every is_household_member
 *   gate (shared categories/transactions/goals + every aggregate RPC). Personal data
 *   (categories/allowance/own transactions) and household history (their shared rows keep
 *   household_id + user_id) are deliberately left untouched.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';
import type { HouseholdMemberListEntry } from '@/types/database.types';

/** Admin tried to remove themselves via the removal endpoint. → 400 */
export class CannotRemoveSelfError extends Error {
  constructor(message = 'You cannot remove yourself from the household') {
    super(message);
    this.name = 'CannotRemoveSelfError';
  }
}

/** Target user is not a member of the admin's household. → 404 */
export class MemberNotFoundError extends Error {
  constructor(message = 'Member not found in your household') {
    super(message);
    this.name = 'MemberNotFoundError';
  }
}

/**
 * Lists the caller's household members (membership-gated). Empty if the caller has none.
 */
export async function listHouseholdMembers(userId: string): Promise<HouseholdMemberListEntry[]> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  const householdId = membership?.household_id ?? null;
  if (!householdId) return [];

  const { data, error } = await supabase.rpc('household_members_list', {
    p_household_id: householdId,
  });
  if (error) {
    logger.error('HouseholdMemberService', `members list RPC failed: ${error.message}`);
    throw new Error('Failed to load household members');
  }
  return (data ?? []).map((row) => ({
    ...row,
    isSelf: row.user_id === userId,
  })) as HouseholdMemberListEntry[];
}

/**
 * Removes a member from the admin's household (admin-only). Deleting the membership row is
 * the entire revocation — RLS does the rest.
 * @throws NotHouseholdAdminError | CannotRemoveSelfError | MemberNotFoundError
 */
export async function removeMember(adminUserId: string, targetUserId: string): Promise<void> {
  if (adminUserId === targetUserId) throw new CannotRemoveSelfError();

  const admin = createServiceRoleClient();

  // Caller must be an admin of a household.
  const { data: adminRow, error: adminError } = await admin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', adminUserId)
    .maybeSingle();
  if (adminError) {
    logger.error('HouseholdMemberService', `admin lookup failed: ${adminError.message}`);
    throw new Error('Failed to verify household admin');
  }
  if (!adminRow || adminRow.role !== 'admin') throw new NotHouseholdAdminError();
  const householdId = adminRow.household_id;

  // Target must be a member of the SAME household.
  const { data: targetRow } = await admin
    .from('household_members')
    .select('id')
    .eq('user_id', targetUserId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!targetRow) throw new MemberNotFoundError();

  // ONE TRANSACTION (remove_household_member, migration 20261125100000): the
  // member's SHARED categories, budgets and goals go to the household owner (the
  // single rule, private.move_member_shared_objects), the owner's account notices
  // are written, and the membership row is deleted - all of it or none of it.
  //
  // Why one transaction: this used to be two calls, the reassign THEN the
  // membership delete. Once the owner is TOLD "a member was removed", a delete
  // that failed after the reassign would make that a lie. Atomic, a failure
  // (including the function not existing yet, between deploy and migration)
  // changes nothing and answers 500, and a retry is a clean retry.
  //
  // household_id stays on the moved objects, so remaining members are
  // unaffected. Transactions are NOT reassigned - they keep their user_id
  // attribution per AC#3. The owner is the acting admin: the admin role is only
  // ever granted to the owner, and created_by is server-only.
  const { error: removeError } = await (admin as unknown as SupabaseClient).rpc(
    'remove_household_member',
    { p_household: householdId, p_member: targetUserId }
  );
  if (removeError) {
    logger.error('HouseholdMemberService', `member removal failed: ${removeError.message}`);
    throw new Error('Failed to remove member');
  }

  // Best-effort: notify the removed member. Never fail the removal on a push error.
  try {
    const { data: household } = await admin
      .from('households')
      .select('name')
      .eq('id', householdId)
      .maybeSingle();
    const householdName = (household as { name?: string } | null)?.name ?? 'a household';
    // Story 15.5: through the central gate ('household' toggle + quiet hours)
    await dispatchCategorizedPush(targetUserId, 'household', {
      type: 'household_event',
      title: 'Household access removed',
      body: `You've been removed from ${householdName}.`,
      data: { url: '/settings' },
    });
  } catch (pushError) {
    logger.error('HouseholdMemberService', 'Best-effort removal notification failed:', pushError);
  }
}
