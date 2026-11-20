/**
 * A refused account deletion, described truthfully (spec-account-deletion-refused-message).
 *
 * deleteUserAccount runs prepare_account_deletion FIRST and admin.deleteUser LAST.
 * When the auth delete is refused, the preparation's writes STAND: the household
 * may now belong to someone else, and the person's shared categories, budgets and
 * goals now belong to the household owner. The deletion dialog tells the person
 * which of those happened, in their own language. Nothing is stored.
 *
 * What changed is read from prepare_account_deletion's OWN result, never
 * recomputed here: a second computation would be a second definition of the
 * same rules, free to drift from the one that actually ran.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import type { RefusalOutcome } from '@/types/accountDeletion.types';

export { ACCOUNT_NOT_DELETED, type RefusalOutcome } from '@/types/accountDeletion.types';

/** What prepare_account_deletion reported doing, reduced to what the dialog says. */
export interface PreparedChanges {
  ownershipTransferred: boolean;
  sharedObjectsMoved: boolean;
}

/**
 * admin.deleteUser refused AFTER the preparation ran, and the auth user was then
 * confirmed to still exist. Only this error may produce "your account was not
 * deleted".
 */
export class AccountDeletionRefusedError extends Error {
  readonly ownershipTransferred: boolean;
  readonly sharedObjectsMoved: boolean;

  constructor(changes: PreparedChanges, cause: string) {
    super(`Account deletion refused after preparation: ${cause}`);
    this.name = 'AccountDeletionRefusedError';
    this.ownershipTransferred = changes.ownershipTransferred;
    this.sharedObjectsMoved = changes.sharedObjectsMoved;
  }
}

/**
 * Reads prepare_account_deletion's JSONB result. Returns null for any other
 * shape: an unrecognised result can never be described, so a refusal then gets
 * the generic message rather than a guess. It never blocks a deletion.
 */
export function readPreparedChanges(data: unknown): PreparedChanges | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const result = data as Record<string, unknown>;
  const transferred = result.ownership_transferred;
  const moved = result.shared_objects_moved;
  if (typeof transferred !== 'boolean') return null;
  if (typeof moved !== 'number' || !Number.isInteger(moved) || moved < 0) return null;
  return { ownershipTransferred: transferred, sharedObjectsMoved: moved > 0 };
}

export function refusalOutcome(changes: PreparedChanges): RefusalOutcome {
  if (changes.ownershipTransferred) {
    return changes.sharedObjectsMoved ? 'transferredShared' : 'transferred';
  }
  return changes.sharedObjectsMoved ? 'shared' : 'unchanged';
}

export interface RefusalNames {
  household: string;
  /** The household owner, named as the household page names members: by email. */
  owner: string;
}

/**
 * The household the refused person is (still) a member of, and its owner.
 *
 * Runs on the person's OWN session, so RLS bounds it to what they can already
 * see on the household page. Never throws: null means "cannot name them", and
 * the caller falls back to the generic message.
 */
export async function resolveRefusalNames(
  client: SupabaseClient,
  userId: string
): Promise<RefusalNames | null> {
  try {
    const { data: membership, error: membershipError } = await client
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .maybeSingle();
    const householdId = (membership as { household_id?: string } | null)?.household_id;
    if (membershipError || !householdId) {
      logger.warn('AccountDeletionRefusal', 'no household to name for a refused deletion', {
        error: membershipError?.message,
      });
      return null;
    }

    const { data: household, error: householdError } = await client
      .from('households')
      .select('name, created_by')
      .eq('id', householdId)
      .maybeSingle();
    const { name, created_by: ownerId } =
      (household as { name?: string; created_by?: string } | null) ?? {};
    // The flags say the household or the shared objects went to SOMEONE ELSE. If
    // the person still owns it, the flags and the database disagree: name nobody.
    if (householdError || !name || !ownerId || ownerId === userId) {
      logger.warn('AccountDeletionRefusal', 'household owner unresolvable for a refused deletion', {
        error: householdError?.message,
      });
      return null;
    }

    const { data: members, error: membersError } = await client.rpc('household_members_list', {
      p_household_id: householdId,
    });
    const owner = Array.isArray(members)
      ? (members as Array<{ user_id?: string; email?: string }>).find((m) => m.user_id === ownerId)
      : undefined;
    if (membersError || !owner?.email) {
      logger.warn('AccountDeletionRefusal', 'owner email unresolvable for a refused deletion', {
        error: membersError?.message,
      });
      return null;
    }

    return { household: name, owner: owner.email };
  } catch (error) {
    logger.warn('AccountDeletionRefusal', 'name lookup threw for a refused deletion', { error });
    return null;
  }
}
