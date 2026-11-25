/**
 * API Route: Remove a household member
 * Story 13.11
 *
 * DELETE /api/households/members/[userId] - admin removes a member (immediate revocation).
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  removeMember,
  CannotRemoveSelfError,
  MemberNotFoundError,
} from '@/lib/services/householdMemberService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';
import { logger } from '@/lib/utils/logger';
import {
  deliverAccountNoticePushes,
  NOTICE_CLOCK_SKEW_MS,
} from '@/lib/services/accountNoticeService';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

    const { userId } = await params;
    const requestStart = Date.now();
    await removeMember(user.id, userId);
    // The removal wrote the owner's notices in its own transaction; their PUSHES
    // go out after the response, off the critical path. Only after SUCCESS: a
    // failed or refused removal wrote nothing, so there is nothing to send - and
    // a request that fails authorisation cannot trigger a scan.
    after(() =>
      deliverAccountNoticePushes({ since: new Date(requestStart - NOTICE_CLOCK_SKEW_MS) })
    );
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof CannotRemoveSelfError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    if (error instanceof NotHouseholdAdminError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 403 });
    }
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 404 });
    }
    logger.error('HouseholdMemberRemove', 'DELETE failed:', error);
    return NextResponse.json({ error: { message: 'Failed to remove member' } }, { status: 500 });
  }
}
