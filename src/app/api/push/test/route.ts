/**
 * POST /api/push/test
 * Sends a test push notification to the authenticated user's subscribed devices.
 * Lets users verify the full push pipeline (VAPID config + subscription + service worker)
 * from Settings. Returns how many devices were targeted so the UI can give clear feedback.
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/services/pushService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Server-side guard: clear signal when push isn't configured for the deployment.
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return NextResponse.json({ error: { message: 'Push notifications are not configured on the server' } }, { status: 503 });
    }

    const admin = createServiceRoleClient();
    const { count } = await admin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const deviceCount = count ?? 0;
    if (deviceCount === 0) {
      return NextResponse.json({ data: { sent: 0 } });
    }

    await sendPushToUser(admin, user.id, {
      type: 'test',
      title: 'Smart Budget',
      body: 'Test notification — your notifications are working! 🎉',
      data: { url: '/settings' },
    });

    return NextResponse.json({ data: { sent: deviceCount } });
  } catch (error) {
    logger.error('PushTest', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to send test notification' } }, { status: 500 });
  }
}
