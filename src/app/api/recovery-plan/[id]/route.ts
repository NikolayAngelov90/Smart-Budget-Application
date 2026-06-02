/**
 * Recovery Plan Item API Route
 * Story 12.4 / FR4
 *
 * PATCH /api/recovery-plan/[id] — update plan status (abandoned | completed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updatePlanStatus } from '@/lib/services/recoveryPlanService';
import { logger } from '@/lib/utils/logger';

const VALID_STATUSES = ['abandoned', 'completed'] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string): s is ValidStatus {
  return (VALID_STATUSES as readonly string[]).includes(s);
}

export async function PATCH(
  request: NextRequest,
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
    const body = (await request.json()) as { status?: string };

    if (!body.status || !isValidStatus(body.status)) {
      return NextResponse.json(
        { error: { message: 'Invalid status. Expected "abandoned" or "completed".' } },
        { status: 400 }
      );
    }

    await updatePlanStatus(supabase, user.id, id, body.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('RecoveryPlanAPI', 'Error updating recovery plan status:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update recovery plan' } },
      { status: 500 }
    );
  }
}
