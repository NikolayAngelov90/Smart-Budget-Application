/**
 * POST /api/push/subscribe
 * Story 12.3: Real-Time Smart Nudges
 *
 * Saves a Web Push subscription endpoint for the authenticated user.
 * Upserts on (user_id, endpoint) — idempotent; safe to call on each page load.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: endpoint, keys.p256dh, keys.auth' } },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      logger.error('PushSubscribe', 'Failed to upsert subscription:', error);
      return NextResponse.json({ error: { message: 'Failed to save subscription' } }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('PushSubscribe', 'Unexpected error:', error);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
