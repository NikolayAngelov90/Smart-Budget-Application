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
import type { HouseholdInvitation, HouseholdInvitationWithState } from '@/types/database.types';

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
  return data as HouseholdInvitation;
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
