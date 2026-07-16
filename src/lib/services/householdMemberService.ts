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

  const { data, error } = await supabase.rpc('household_members_list', { p_household_id: householdId });
  if (error) {
    logger.error('HouseholdMemberService', `members list RPC failed: ${error.message}`);
    throw new Error('Failed to load household members');
  }
  return (data ?? []).map((row) => ({ ...row, isSelf: row.user_id === userId })) as HouseholdMemberListEntry[];
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

  // The revocation: delete the membership row.
  const { error: deleteError } = await admin
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', targetUserId);
  if (deleteError) {
    logger.error('HouseholdMemberService', `member delete failed: ${deleteError.message}`);
    throw new Error('Failed to remove member');
  }

  // Reassign the SHARED categories + goals the removed member created to the admin, so the
  // ex-member loses the owner-branch read/WRITE over shared structures (without it they
  // could still rename/delete a shared category or goal they own). household_id is kept, so
  // remaining members are unaffected. Transactions are NOT reassigned — they keep their
  // user_id attribution per AC#3 (the ex-member only retains sight of their own entries).
  const genericAdmin = admin as unknown as SupabaseClient;
  const { error: catReassignError } = await admin
    .from('categories')
    .update({ user_id: adminUserId })
    .eq('user_id', targetUserId)
    .eq('household_id', householdId);
  if (catReassignError) {
    logger.error('HouseholdMemberService', `category reassign failed: ${catReassignError.message}`);
  }
  const { error: goalReassignError } = await genericAdmin
    .from('goals')
    .update({ user_id: adminUserId })
    .eq('user_id', targetUserId)
    .eq('household_id', householdId);
  if (goalReassignError) {
    logger.error('HouseholdMemberService', `goal reassign failed: ${goalReassignError.message}`);
  }

  // Best-effort: notify the removed member. Never fail the removal on a push error.
  try {
    const { data: household } = await admin.from('households').select('name').eq('id', householdId).maybeSingle();
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
