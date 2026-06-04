/**
 * API Route: Invitations (collection)
 * Story 13.2: Household Invitation Flow
 *
 * POST /api/invitations  - admin creates an invite (returns invite + shareable accept link)
 * GET  /api/invitations   - admin lists their household's invitations
 *
 * Security: authentication required; only household admins (enforced in the service).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  createInvitation,
  listInvitations,
  NotHouseholdAdminError,
  InvitationExistsError,
} from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';
import type { HouseholdInvitationWithState } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const createInvitationSchema = z.object({
  email: z.string().trim().min(3).max(254).email('A valid email address is required'),
});

/** Builds the shareable accept link from the request origin (join page is Story 13.3). */
function acceptLinkFor(request: NextRequest, token: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  return `${origin}/join?token=${token}`;
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
    const parsed = createInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'Validation failed', details: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const invitation = await createInvitation(user.id, parsed.data.email);
    return NextResponse.json(
      { data: { ...invitation, acceptLink: acceptLinkFor(request, invitation.token) } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof NotHouseholdAdminError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    if (error instanceof InvitationExistsError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 409 });
    }
    if (error instanceof Error && /valid email/i.test(error.message)) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    logger.error('Invitations', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to create invitation' } }, { status: 500 });
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

    const invitations = await listInvitations(user.id);
    const withLinks: HouseholdInvitationWithState[] = invitations.map((inv) => ({
      ...inv,
      acceptLink: acceptLinkFor(request, inv.token),
    }));
    return NextResponse.json({ data: withLinks });
  } catch (error) {
    if (error instanceof NotHouseholdAdminError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    logger.error('Invitations', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to list invitations' } }, { status: 500 });
  }
}
