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
import { createServiceRoleClient } from '@/lib/supabase/server';
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
  type:
    | 'nudge'
    | 'milestone'
    | 'reengagement'
    | 'household_event'
    | 'test'
    // Story 15.5 (additive — the worker only reads title/body/data.url)
    | 'achievement'
    | 'digest'
    | 'comeback';
  title: string;
  body: string;
  data?: { url?: string };
}

/** Story 15.5: per-category notification toggles (ADR-018 / FR33) */
export type PushCategory = 'nudges' | 'milestones' | 'household' | 'digest' | 'reengagement';

/**
 * Category → preference flag + default. Opt-IN (false) for interruptive
 * outreach (nudges, re-engagement); default ON for categories that are
 * direct responses to the user's own/household activity — subscribing to
 * push at all was the opt-in for those.
 */
const CATEGORY_PREFS: Record<PushCategory, { flag: string; defaultEnabled: boolean }> = {
  nudges: { flag: 'push_nudges_enabled', defaultEnabled: false },
  reengagement: { flag: 'push_reengagement_enabled', defaultEnabled: false },
  milestones: { flag: 'push_milestones_enabled', defaultEnabled: true },
  household: { flag: 'push_household_enabled', defaultEnabled: true },
  digest: { flag: 'push_digest_enabled', defaultEnabled: true },
};

/**
 * Dispatch outcome — the gate never throws, so telemetry reads the return:
 * 'sent' = handed to web-push, 'suppressed' = toggle off or quiet hours,
 * 'failed' = preferences unreadable or internal error.
 */
export type PushDispatchOutcome = 'sent' | 'suppressed' | 'failed';

/**
 * Story 15.5: THE single dispatch gate (AC5) — every push in the app goes
 * through here. Enforces the recipient's per-category toggle and quiet hours
 * exactly once, then delegates to sendPushToUser. Uses the service-role
 * client internally: dispatch runs in server contexts (routes, services,
 * crons) where the RECIPIENT may not be the session user, or there is no
 * session at all. Never throws — pushes are best-effort by policy.
 *
 * Documented decision: quiet hours SUPPRESS, they never defer. For event
 * pushes the next event retriggers; for one-shot fixed-time cron pushes
 * (digest, re-engagement) a quiet window covering the cron hour drops that
 * push permanently. Accepted trade-off — a defer/sent-marker design is
 * tracked in deferred-work.md.
 */
export async function dispatchCategorizedPush(
  userId: string,
  category: PushCategory,
  payload: PushPayload
): Promise<PushDispatchOutcome> {
  try {
    const supabase = createServiceRoleClient() as unknown as SupabaseClient;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Unknowable preferences → don't push (never interrupt without consent)
      logger.warn('PushService', `prefs read failed for ${userId} — push skipped:`, error);
      return 'failed';
    }

    const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
    const { flag, defaultEnabled } = CATEGORY_PREFS[category];
    const enabled = (prefs[flag] as boolean | undefined) ?? defaultEnabled;
    if (!enabled) return 'suppressed';

    // Story 15.6: achievement pushes are gamification surface — a user who
    // opted out of gamification must not get "Achievement unlocked!" pushes.
    // Scoped to payload TYPE, not the category: household shared-goal
    // milestone pushes ride the same 'milestones' category but are
    // collaboration features and stay governed by push_milestones_enabled.
    if (payload.type === 'achievement' && prefs.gamification_enabled === false) {
      return 'suppressed';
    }

    const quietStart = (prefs.quiet_hours_start as number | undefined) ?? 22;
    const quietEnd = (prefs.quiet_hours_end as number | undefined) ?? 8;
    if (isWithinQuietHours(quietStart, quietEnd)) return 'suppressed';

    await sendPushToUser(supabase, userId, payload);
    return 'sent';
  } catch (err) {
    logger.warn('PushService', `dispatch failed for ${userId} (non-fatal):`, err);
    return 'failed';
  }
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
