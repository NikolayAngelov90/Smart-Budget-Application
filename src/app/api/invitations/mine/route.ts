/**
 * API Route: My pending invitations
 * Story 13.2 follow-up — in-app invite delivery.
 *
 * GET /api/invitations/mine - pending, non-expired invitations addressed to the
 * authenticated user's email (so they can accept in-app without the shared link).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listMyPendingInvitations } from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const invitations = await listMyPendingInvitations(user.email ?? '');
    return NextResponse.json({ data: invitations });
  } catch (error) {
    logger.error('InvitationsMine', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load invitations' } }, { status: 500 });
  }
}
