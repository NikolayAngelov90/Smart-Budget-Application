/**
 * API Route: Accept / validate an invitation
 * Story 13.3: Join Household via Invitation
 *
 * POST /api/invitations/accept { token }       - accept (join the household)
 * GET  /api/invitations/accept?token=<token>   - read-only validation for the /join page
 *
 * Email-bound: the check uses the AUTHENTICATED user's email, never a client value.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  acceptInvitation,
  validateInvitation,
  InvalidTokenError,
  InvitationNotPendingError,
  InvitationExpiredError,
  EmailMismatchError,
  AlreadyInHouseholdError,
} from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const acceptSchema = z.object({ token: z.string().uuid('Invalid invitation token') });

function mapError(error: unknown): { status: number; message: string } | null {
  if (error instanceof InvalidTokenError) return { status: 404, message: error.message };
  if (error instanceof InvitationNotPendingError) return { status: 409, message: error.message };
  if (error instanceof InvitationExpiredError) return { status: 410, message: error.message };
  if (error instanceof EmailMismatchError) return { status: 403, message: error.message };
  if (error instanceof AlreadyInHouseholdError) return { status: 409, message: error.message };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { message: 'A valid invitation token is required' } }, { status: 400 });
    }

    const household = await acceptInvitation(user.id, user.email ?? '', parsed.data.token);
    return NextResponse.json({ data: household });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped) return NextResponse.json({ error: { message: mapped.message } }, { status: mapped.status });
    logger.error('InvitationsAccept', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to accept invitation' } }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const token = request.nextUrl.searchParams.get('token') ?? '';
    if (!token) {
      return NextResponse.json({ data: { valid: false, reason: 'invalid' } });
    }

    const validation = await validateInvitation(user.id, user.email ?? '', token);
    return NextResponse.json({ data: validation });
  } catch (error) {
    logger.error('InvitationsAccept', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to validate invitation' } }, { status: 500 });
  }
}
