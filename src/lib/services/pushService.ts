/**
 * Push Service — Story 12.3
 *
 * Server-side Web Push dispatch using the `web-push` library.
 * Sends notifications to all subscribed devices for a user.
 * Handles stale endpoints (410/404) and respects quiet hours.
 *
 * Pattern: accepts Supabase client as parameter (never creates its own).
 */

import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

// Configure VAPID once at module init (env vars validated at runtime)
if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  type: 'nudge' | 'milestone' | 'reengagement' | 'household_event' | 'test';
  title: string;
  body: string;
  data?: { url?: string };
}

/**
 * Returns true if the current UTC hour falls within the configured quiet window.
 * Supports overnight ranges (e.g., 22-08) and same-day ranges (e.g., 02-06).
 */
export function isWithinQuietHours(quietStart: number, quietEnd: number): boolean {
  const hour = new Date().getUTCHours();
  if (quietStart === quietEnd) return false; // degenerate range — never quiet
  if (quietStart > quietEnd) {
    // Spans midnight: quiet if hour >= start OR hour < end
    return hour >= quietStart || hour < quietEnd;
  }
  // Same-day range: quiet if start <= hour < end
  return hour >= quietStart && hour < quietEnd;
}

/**
 * Sends a push notification to all devices subscribed for the given user.
 * Uses best-effort delivery: errors per device are logged but not re-thrown.
 * Stale subscriptions (410 Gone or 404 Not Found) are deleted automatically.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    logger.error('PushService', 'VAPID keys not configured — push disabled');
    return;
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    logger.error('PushService', 'Failed to fetch push subscriptions:', error);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // Subscription is stale — remove it
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          if (deleteError) {
            logger.error('PushService', `Failed to delete stale subscription ${sub.id}:`, deleteError);
          } else {
            logger.info('PushService', `Deleted stale subscription ${sub.id} (${status})`);
          }
        } else {
          logger.error('PushService', `Push failed for endpoint ${sub.endpoint}:`, err);
        }
      }
    })
  );
}
