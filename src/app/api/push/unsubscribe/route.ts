/**
 * DELETE /api/push/unsubscribe
 * Story 12.3: Real-Time Smart Nudges
 *
 * Removes a Web Push subscription for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json() as { endpoint?: string };

    if (!body.endpoint) {
      return NextResponse.json(
        { error: { message: 'Missing required field: endpoint' } },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint);

    if (error) {
      logger.error('PushUnsubscribe', 'Failed to delete subscription:', error);
      return NextResponse.json({ error: { message: 'Failed to remove subscription' } }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('PushUnsubscribe', 'Unexpected error:', error);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
