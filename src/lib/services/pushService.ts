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
if (
  process.env.VAPID_SUBJECT &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
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
/**
 * DW-4: 'deferred' is distinct from 'suppressed' on purpose. Suppressed means
 * the user opted out and nothing should ever be sent. Deferred means "not
 * now" — the caller is expected to try again once quiet hours are over. Folding
 * the two together is what made a mild preference read as a permanent opt-out,
 * and it also made the telemetry lie about why nothing arrived.
 */
export type PushDispatchOutcome =
  | 'sent'
  | 'suppressed'
  | 'deferred'
  | 'failed'
  | 'no_subscription'
  | 'not_configured';

/**
 * What actually happened when we handed the message to the push service.
 *
 * "GENUINE DELIVERY" IS NOT AVAILABLE TO US. A 2xx from a push service means the
 * SERVICE ACCEPTED the message — not that the device received it, not that the
 * user saw it. `accepted` is therefore the strongest thing this code can know,
 * and it is named that way so nothing downstream implies more.
 */
export type PushSendResult =
  /** At least one subscription was accepted (2xx) by the push service. */
  | 'accepted'
  /** Network error, 5xx, timeout. Worth retrying — nothing is known to be wrong. */
  | 'transient'
  /** Every endpoint returned 404/410 and has been PRUNED. Nothing to retry. */
  | 'permanent'
  /** The user has no push subscription. Nothing to deliver, nothing to retry. */
  | 'none'
  /** The subscription lookup itself failed — treat as transient. */
  | 'lookup_failed'
  /** VAPID keys are absent, so push cannot work for ANYONE. */
  | 'unconfigured';

/**
 * Whether push is configured at all. Cheap, and callers that process a COHORT
 * should check it ONCE before the loop rather than discovering it per user.
 *
 * This exists because of the failure it prevents: with VAPID absent,
 * `sendPushToUser` used to return silently and `dispatchCategorizedPush` returned
 * 'sent', so every user in the cohort was written a delivery marker, permanently
 * suppressing a notification nobody ever received. A job whose healthy state
 * produces the same signal as its dead state cannot be monitored — see
 * docs/api-conventions.md, Scheduled Work (cron) — Observability.
 */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

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

    // Story 15.6: gamification-surface pushes must not reach a user who opted
    // out of gamification. Scoped to payload TYPE, not category:
    //  - 'achievement' = "Achievement unlocked!" (milestones category)
    //  - 'comeback'    = the reengagement cron's "Your streak is waiting"
    //                    (reengagement category) — streak-flavored, so gated
    // Deliberately NOT gated: 'milestone' (household shared-goal — a
    // collaboration feature on the same 'milestones' category, governed only
    // by push_milestones_enabled), 'nudge', 'digest', 'household_event'.
    if (
      (payload.type === 'achievement' || payload.type === 'comeback') &&
      prefs.gamification_enabled === false
    ) {
      return 'suppressed';
    }

    const quietStart = (prefs.quiet_hours_start as number | undefined) ?? 22;
    const quietEnd = (prefs.quiet_hours_end as number | undefined) ?? 8;
    // Evaluated in the USER's timezone. Before DW-4 this compared against UTC
    // hours, so "22:00-08:00" was applied at 22:00 UTC — 01:00-11:00 for a
    // Sofia user. The window was shifted by their whole offset.
    if (isWithinQuietHours(quietStart, quietEnd, prefs.timezone as string | undefined)) {
      return 'deferred';
    }

    const result = await sendPushToUser(supabase, userId, payload);
    switch (result) {
      case 'accepted':
        // The ONLY outcome that writes a delivery marker.
        return 'sent';
      case 'none':
        // Nothing to deliver and nothing to retry. Deliberately NOT recorded:
        // the ABSENCE of a delivery row already means "not delivered", which is
        // true, so no status column is needed to say it.
        return 'no_subscription';
      case 'permanent':
        // Every endpoint was dead and has been pruned. Not retryable, and not a
        // delivery — so no marker, and next run finds no subscription at all.
        return 'failed';
      case 'unconfigured':
        return 'not_configured';
      case 'transient':
      case 'lookup_failed':
      default:
        // Retried on the next run. THIS is the case the fix exists for.
        return 'failed';
    }
  } catch (err) {
    logger.warn('PushService', `dispatch failed for ${userId} (non-fatal):`, err);
    return 'failed';
  }
}

/**
 * Returns true if the user's LOCAL hour falls within their quiet window.
 * Supports overnight ranges (e.g., 22-08) and same-day ranges (e.g., 02-06).
 *
 * `timeZone` is an IANA name captured from the browser. Without one this falls
 * back to UTC, which is the pre-DW-4 behaviour — wrong for most people, but the
 * only thing available for a profile that has never opened the app since the
 * preference was added.
 */
export function isWithinQuietHours(
  quietStart: number,
  quietEnd: number,
  timeZone?: string,
  now: Date = new Date()
): boolean {
  const hour = localHourIn(timeZone, now);
  if (quietStart === quietEnd) return false; // degenerate range — never quiet
  if (quietStart > quietEnd) {
    // Spans midnight: quiet if hour >= start OR hour < end
    return hour >= quietStart || hour < quietEnd;
  }
  // Same-day range: quiet if start <= hour < end
  return hour >= quietStart && hour < quietEnd;
}

/**
 * The hour (0-23) it currently is for the given IANA timezone.
 *
 * `Intl` does the offset arithmetic, including DST, which hand-rolled offsets
 * get wrong twice a year. An unknown or malformed zone falls back to UTC rather
 * than throwing — a bad stored value must not stop a notification.
 */
export function localHourIn(timeZone: string | undefined, now: Date = new Date()): number {
  if (!timeZone) return now.getUTCHours();
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const parsed = Number.parseInt(hour, 10);
    // 'en-US' with hour12:false renders midnight as 24 in some ICU versions.
    return Number.isNaN(parsed) ? now.getUTCHours() : parsed % 24;
  } catch {
    return now.getUTCHours();
  }
}

/**
 * Sends a push notification to all devices subscribed for the given user, and
 * REPORTS WHAT HAPPENED.
 *
 * IT USED TO RETURN `void` AND SWALLOW EVERY FAILURE MODE — missing VAPID keys, a
 * failed subscription lookup, zero subscriptions, and a rejected send were all
 * indistinguishable from success. `dispatchCategorizedPush` then returned 'sent'
 * in all of them, and the cron routes write a delivery marker on 'sent'. Since
 * the marker is what `getAlreadyDelivered` consults to SKIP a user, and no code
 * path ever deletes one, a single false 'sent' permanently suppressed that
 * period's notification: the user never received it and never got another chance.
 *
 * Measured 2026-09-24: 24 weekly_digest markers across 3 users while only ONE push
 * subscription existed in the whole system.
 *
 * Stale subscriptions (410 Gone / 404 Not Found) are still pruned — and that is
 * what makes "do not mark on failure" safe rather than merely correct. Without
 * pruning, a dead endpoint would be retried on every run forever, erroring each
 * time and never resolving, which is a worse steady state than the bug.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!isPushConfigured()) {
    logger.error('PushService', 'VAPID keys not configured — push disabled');
    return 'unconfigured';
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    logger.error('PushService', 'Failed to fetch push subscriptions:', error);
    return 'lookup_failed';
  }

  if (!subscriptions || subscriptions.length === 0) return 'none';

  const body = JSON.stringify(payload);

  let accepted = 0;
  let transient = 0;
  let permanent = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        accepted++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          permanent++;
          // Subscription is stale — remove it. 410 Gone is the push protocol
          // saying this endpoint is dead; keeping it means retrying a corpse.
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          if (deleteError) {
            logger.error(
              'PushService',
              `Failed to delete stale subscription ${sub.id}:`,
              deleteError
            );
          } else {
            logger.info('PushService', `Deleted stale subscription ${sub.id} (${status})`);
          }
        } else {
          transient++;
          logger.error('PushService', `Push failed for endpoint ${sub.endpoint}:`, err);
        }
      }
    })
  );

  // ONE acceptance is enough to call the notification delivered: the user has it
  // on at least one device, and re-sending would duplicate it there.
  if (accepted > 0) return 'accepted';
  // A transient failure anywhere outranks a permanent one, because the transient
  // endpoint is still worth retrying and the permanent ones are already pruned.
  if (transient > 0) return 'transient';
  if (permanent > 0) return 'permanent';
  return 'none';
}
