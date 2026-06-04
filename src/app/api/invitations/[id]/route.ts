/**
 * API Route: Invitation (item)
 * Story 13.2: Household Invitation Flow
 *
 * DELETE /api/invitations/:id - admin revokes a pending invitation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  revokeInvitation,
  NotHouseholdAdminError,
  InvitationNotFoundError,
} from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    await revokeInvitation(user.id, id);
    return NextResponse.json({ data: { revoked: true } });
  } catch (error) {
    if (error instanceof NotHouseholdAdminError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 404 });
    }
    logger.error('Invitations', 'DELETE failed:', error);
    return NextResponse.json({ error: { message: 'Failed to revoke invitation' } }, { status: 500 });
  }
}
