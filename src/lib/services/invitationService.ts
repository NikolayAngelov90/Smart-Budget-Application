/**
 * Invitation Service
 * Story 13.2: Household Invitation Flow
 *
 * Admins invite people to their household by email. Tokens are single-use,
 * email-bound, and expire in 48h (ADR-016 / NFR12). Acceptance/join is Story 13.3.
 *
 * Writes use the service-role client (bypasses RLS); the admin check below IS the
 * authorization. Reads here are admin-gated by the same check. Independent RLS
 * isolation is verified by the real-DB harness (invitations.rls.test.ts).
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { sendPushToUser } from '@/lib/services/pushService';
import type { Household, HouseholdInvitation, HouseholdInvitationWithState, MyInvitation } from '@/types/database.types';

/** Caller is not an admin of any household (or not in one). → 403 */
export class NotHouseholdAdminError extends Error {
  constructor(message = 'Only a household admin can manage invitations') {
    super(message);
    this.name = 'NotHouseholdAdminError';
  }
}

/** An active (pending) invite to this email already exists. → 409 */
export class InvitationExistsError extends Error {
  constructor(message = 'An active invitation for this email already exists') {
    super(message);
    this.name = 'InvitationExistsError';
  }
}

/** Invitation not found in the caller's household. → 404 */
export class InvitationNotFoundError extends Error {
  constructor(message = 'Invitation not found') {
    super(message);
    this.name = 'InvitationNotFoundError';
  }
}

/** Token does not match any invitation (Story 13.3 accept). → 404 */
export class InvalidTokenError extends Error {
  constructor(message = 'This invitation link is invalid') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/** Invitation is no longer pending (already accepted or revoked). → 409 */
export class InvitationNotPendingError extends Error {
  constructor(message = 'This invitation has already been used or was revoked') {
    super(message);
    this.name = 'InvitationNotPendingError';
  }
}

/** Invitation has expired. → 410 */
export class InvitationExpiredError extends Error {
  constructor(message = 'This invitation has expired') {
    super(message);
    this.name = 'InvitationExpiredError';
  }
}

/** Authenticated user's email does not match the invitation (email-bound, NFR12). → 403 */
export class EmailMismatchError extends Error {
  constructor(message = 'This invitation was sent to a different email address') {
    super(message);
    this.name = 'EmailMismatchError';
  }
}

/** Caller already belongs to a household (one-household-per-user, MVP). → 409 */
export class AlreadyInHouseholdError extends Error {
  constructor(message = 'You already belong to a household') {
    super(message);
    this.name = 'AlreadyInHouseholdError';
  }
}

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const PG_UNIQUE_VIOLATION = '23505';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Resolves the caller's household and asserts they are its admin.
 * @throws NotHouseholdAdminError if the user has no household or isn't an admin.
 */
async function requireAdminHouseholdId(userId: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('InvitationService', `Admin lookup failed for ${userId}: ${error.message}`);
    throw new Error('Failed to verify household admin');
  }
  if (!data || data.role !== 'admin') {
    throw new NotHouseholdAdminError();
  }
  return data.household_id;
}

/**
 * Creates a pending invitation for `email` in the caller's household.
 * @throws NotHouseholdAdminError | InvitationExistsError | Error
 */
export async function createInvitation(userId: string, email: string): Promise<HouseholdInvitation> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized) || normalized.length > 254) {
    throw new Error('A valid email address is required');
  }

  const householdId = await requireAdminHouseholdId(userId);
  const admin = createServiceRoleClient();

  // Friendly pre-check (the partial unique index is the race-safe backstop below).
  const { data: existing } = await admin
    .from('household_invitations')
    .select('id')
    .eq('household_id', householdId)
    .eq('email', normalized)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    throw new InvitationExistsError();
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { data, error } = await admin
    .from('household_invitations')
    .insert({ household_id: householdId, email: normalized, invited_by: userId, expires_at: expiresAt })
    .select()
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new InvitationExistsError();
    }
    logger.error('InvitationService', `Invitation insert failed for ${userId}: ${error.message}`);
    throw new Error('Failed to create invitation');
  }

  // Best-effort: if the invitee already has an account, push them a notification so they
  // know without the admin having to share the link manually. Never fail the invite on this.
  await notifyInviteeIfRegistered(admin, normalized, householdId).catch((err) => {
    logger.error('InvitationService', 'Best-effort invitee notification failed:', err);
  });

  return data as HouseholdInvitation;
}

/**
 * Pushes an "invited" notification to the invitee IF their email maps to an existing
 * account. No-op when the email isn't registered yet (they'll see the in-app banner once
 * they sign up with that address and the link is shared). Best-effort.
 */
async function notifyInviteeIfRegistered(
  admin: ServiceClient,
  email: string,
  householdId: string
): Promise<void> {
  const { data: inviteeId, error } = await admin.rpc('user_id_by_email', { p_email: email });
  if (error || !inviteeId) return;

  const { data: household } = await admin
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();
  const householdName = (household as { name?: string } | null)?.name ?? 'a household';

  await sendPushToUser(admin, inviteeId as string, {
    type: 'household_event',
    title: 'Household invitation',
    body: `You've been invited to join ${householdName}.`,
    data: { url: '/settings' },
  });
}

/**
 * Lists the caller's household invitations (newest first), with computed expiry.
 * @throws NotHouseholdAdminError
 */
export async function listInvitations(userId: string): Promise<HouseholdInvitationWithState[]> {
  const householdId = await requireAdminHouseholdId(userId);
  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from('household_invitations')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('InvitationService', `List failed for ${userId}: ${error.message}`);
    throw new Error('Failed to list invitations');
  }

  const now = Date.now();
  return (data ?? []).map((inv) => ({
    ...(inv as HouseholdInvitation),
    isExpired: new Date((inv as HouseholdInvitation).expires_at).getTime() < now,
  }));
}

/**
 * Revokes a pending invitation in the caller's household. Idempotent for
 * already non-pending invites; 404 if it isn't in the caller's household.
 * @throws NotHouseholdAdminError | InvitationNotFoundError
 */
export async function revokeInvitation(userId: string, invitationId: string): Promise<void> {
  const householdId = await requireAdminHouseholdId(userId);
  const admin = createServiceRoleClient();

  const { data: existing, error: lookupError } = await admin
    .from('household_invitations')
    .select('id, status')
    .eq('id', invitationId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (lookupError) {
    logger.error('InvitationService', `Revoke lookup failed for ${userId}: ${lookupError.message}`);
    throw new Error('Failed to revoke invitation');
  }
  if (!existing) {
    throw new InvitationNotFoundError();
  }
  if (existing.status !== 'pending') {
    return; // idempotent — already accepted/revoked
  }

  const { error } = await admin
    .from('household_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('household_id', householdId);

  if (error) {
    logger.error('InvitationService', `Revoke failed for ${userId}: ${error.message}`);
    throw new Error('Failed to revoke invitation');
  }
}

/**
 * Lists the PENDING, non-expired invitations addressed to the given email — i.e. the
 * invitations the current (authenticated) user can accept. Keyed off the caller's own
 * session email, so no cross-user lookup is involved. Powers the in-app invite banner.
 */
export async function listMyPendingInvitations(userEmail: string): Promise<MyInvitation[]> {
  const normalized = normalizeEmail(userEmail);
  if (!normalized) return [];

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('household_invitations')
    .select('id, token, expires_at, households(name)')
    .eq('email', normalized)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('InvitationService', `listMyPendingInvitations failed: ${error.message}`);
    throw new Error('Failed to load your invitations');
  }

  const now = Date.now();
  return (data ?? [])
    .filter((inv) => new Date((inv as { expires_at: string }).expires_at).getTime() >= now)
    .map((inv) => {
      const row = inv as { id: string; token: string; households?: { name?: string } | null };
      return { id: row.id, token: row.token, householdName: row.households?.name ?? 'a household' };
    });
}

// ============================================================================
// Story 13.3: Accept / validate
// ============================================================================

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type InvitationInvalidReason = 'invalid' | 'not_pending' | 'expired' | 'email_mismatch' | 'already_in_household';

export interface InvitationValidation {
  valid: boolean;
  reason?: InvitationInvalidReason;
  householdName?: string;
  invitedEmail?: string;
  emailMatches?: boolean;
}

/** True if the user already belongs to any household (one-household-per-user MVP rule). */
async function isUserInHousehold(admin: ServiceClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('household_members').select('id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

/**
 * Read-only validation for the /join page — never mutates. Reports the precise
 * reason an invitation can't be accepted so the UI can show a clear message.
 */
export async function validateInvitation(
  userId: string,
  userEmail: string,
  token: string
): Promise<InvitationValidation> {
  const admin = createServiceRoleClient();
  const { data: inv, error } = await admin
    .from('household_invitations')
    .select('*, households(name)')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    logger.error('InvitationService', `validate lookup failed: ${error.message}`);
    throw new Error('Failed to validate invitation');
  }
  if (!inv) return { valid: false, reason: 'invalid' };

  const household = (inv as { households?: { name?: string } | null }).households;
  const householdName = household?.name;
  const invitedEmail = inv.email;
  const emailMatches = invitedEmail === userEmail.trim().toLowerCase();
  const base = { householdName, invitedEmail, emailMatches };

  if (inv.status !== 'pending') return { valid: false, reason: 'not_pending', ...base };
  if (new Date(inv.expires_at).getTime() < Date.now()) return { valid: false, reason: 'expired', ...base };
  if (!emailMatches) return { valid: false, reason: 'email_mismatch', ...base };
  if (await isUserInHousehold(admin, userId)) return { valid: false, reason: 'already_in_household', ...base };

  return { valid: true, ...base };
}

/**
 * Accepts an invitation: adds the caller as a member and marks the invite accepted.
 * All checks are server-side; the email-bound check uses the AUTHENTICATED user's email.
 * @throws InvalidTokenError | InvitationNotPendingError | InvitationExpiredError
 *         | EmailMismatchError | AlreadyInHouseholdError
 */
export async function acceptInvitation(userId: string, userEmail: string, token: string): Promise<Household> {
  const admin = createServiceRoleClient();

  const { data: inv, error } = await admin
    .from('household_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    logger.error('InvitationService', `accept lookup failed: ${error.message}`);
    throw new Error('Failed to load invitation');
  }
  if (!inv) throw new InvalidTokenError();
  if (inv.status !== 'pending') throw new InvitationNotPendingError();
  if (new Date(inv.expires_at).getTime() < Date.now()) throw new InvitationExpiredError();
  if (inv.email !== userEmail.trim().toLowerCase()) throw new EmailMismatchError();
  if (await isUserInHousehold(admin, userId)) throw new AlreadyInHouseholdError();

  // Add membership first; only mark the invite accepted once membership exists.
  const { error: memberError } = await admin
    .from('household_members')
    .insert({ household_id: inv.household_id, user_id: userId, role: 'member' });
  if (memberError) {
    if (memberError.code === PG_UNIQUE_VIOLATION) {
      throw new AlreadyInHouseholdError();
    }
    logger.error('InvitationService', `Join membership insert failed for ${userId}: ${memberError.message}`);
    throw new Error('Failed to join household');
  }

  const { error: flipError } = await admin
    .from('household_invitations')
    .update({ status: 'accepted', accepted_by: userId, accepted_at: new Date().toISOString() })
    .eq('id', inv.id);
  if (flipError) {
    // Non-fatal: the membership exists; the invite just wasn't flipped. Log for follow-up.
    logger.error('InvitationService', `Invite ${inv.id} flip-to-accepted failed (membership already created): ${flipError.message}`);
  }

  // Best-effort: notify the inviting admin. Never fail the join on push errors.
  if (inv.invited_by) {
    try {
      await sendPushToUser(admin, inv.invited_by, {
        type: 'household_event',
        title: 'New household member',
        body: `${userEmail} joined your household.`,
        data: { url: '/settings' },
      });
    } catch (pushError) {
      logger.error('InvitationService', 'Best-effort join notification failed:', pushError);
    }
  }

  const { data: household, error: householdError } = await admin
    .from('households')
    .select('*')
    .eq('id', inv.household_id)
    .single();
  if (householdError || !household) {
    logger.error('InvitationService', `Joined household fetch failed: ${householdError?.message}`);
    throw new Error('Joined, but failed to load the household');
  }
  return household as Household;
}
