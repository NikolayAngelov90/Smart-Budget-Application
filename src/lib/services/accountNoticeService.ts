/**
 * Account notices: the push half (spec-account-deletion-notifications).
 *
 * The notices themselves are recorded by the SQL that makes each change
 * (migration 20261125100000), inside a savepoint. This module only DELIVERS
 * them as pushes, off the deletion's critical path:
 *   - the deletion/removal routes call it from `after()`, once the response is
 *     sent;
 *   - the daily cron calls it again, so a deferred (quiet hours) or failed push
 *     is retried for PUSH_RETRY_DAYS after the notice was created.
 *
 * LOCALISED FROM THE START (Niki, 2026-11-20): a push renders in the
 * RECIPIENT's stored language (user_profiles.preferences.language), from the
 * same message files and the same key mapping as the dashboard card.
 *
 * CLAIM, THEN SEND: the route's after() and the cron can overlap, so a run
 * first claims the delivery row (kind `account_notice`, period = notice id)
 * and only the claimant sends. Anything but `sent` releases the claim, which
 * keeps the rule every push here follows: a missing marker means "owed".
 *
 * Never throws: a push is best-effort by policy, and its failure must never
 * reach the deletion or removal that recorded the notice.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';
import en from '../../../messages/en.json';
import bg from '../../../messages/bg.json';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { claimDelivery, releaseDelivery } from '@/lib/services/notificationDeliveryService';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { byPriority, noticeMessage, type AccountNotice } from '@/lib/accountNotices/noticeMessage';
import { logger } from '@/lib/utils/logger';

/** A push older than this is noise; the in-app notice stays until dismissed. */
export const PUSH_RETRY_DAYS = 7;
/** One event can produce several notices for one person; cap the burst. */
export const PUSHES_PER_RECIPIENT_PER_RUN = 3;
/**
 * A route asks for notices created since the request began, minus this: the
 * notice's created_at is the DATABASE clock, the request start the APP's.
 */
export const NOTICE_CLOCK_SKEW_MS = 60_000;
/**
 * Bounds one run; the next run picks up the rest. Also bounds the delivered-
 * marker lookup, whose ids travel in the request URL.
 */
const MAX_NOTICES_PER_RUN = 100;
/** Web push payloads are small (about 4 KB); a long category list must not exceed it. */
const PUSH_TITLE_MAX = 120;
const PUSH_BODY_MAX = 400;

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

const MESSAGES = { en, bg } as const;

export function toSupportedLocale(language: unknown): SupportedLocale {
  return SUPPORTED_LOCALES.includes(language as SupportedLocale)
    ? (language as SupportedLocale)
    : DEFAULT_LOCALE;
}

/**
 * The notice's title and body in `locale`, or null if its params cannot fill the
 * text OR the translator reports an error (a missing key would otherwise come
 * back as a key path - and be pushed and marked sent).
 */
export function renderAccountNotice(
  locale: SupportedLocale,
  notice: AccountNotice
): { title: string; body: string } | null {
  const message = noticeMessage(notice, locale);
  if (!message) return null;
  let failed = false;
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: 'accountNotices',
    onError: () => {
      failed = true;
    },
  }) as unknown as (key: string, values: Record<string, string>) => string;
  const title = t(message.titleKey, message.values);
  const body = t(message.bodyKey, message.values);
  return failed ? null : { title, body };
}

export interface NoticePushResult {
  /** Notices this run tried (after the per-recipient cap). */
  considered: number;
  sent: number;
  /** Quiet hours: retried next run. */
  deferred: number;
  /** Suppressed, no subscription, not configured, or a transient failure: retried next run. */
  notDelivered: number;
  /** Already claimed by another run, or params that cannot fill the text. */
  skipped: number;
}

type NoticeRow = AccountNotice & { recipient_id: string };

/**
 * Pushes every owed notice: undismissed, created within PUSH_RETRY_DAYS (or
 * since `since`, whichever is later), not yet delivered.
 */
export async function deliverAccountNoticePushes(
  options: { since?: Date; now?: Date } = {}
): Promise<NoticePushResult> {
  const result: NoticePushResult = {
    considered: 0,
    sent: 0,
    deferred: 0,
    notDelivered: 0,
    skipped: 0,
  };
  try {
    const supabase = createServiceRoleClient() as unknown as SupabaseClient;
    const now = options.now ?? new Date();
    const windowStart = new Date(now.getTime() - PUSH_RETRY_DAYS * 86_400_000);
    const since = options.since && options.since > windowStart ? options.since : windowStart;

    const { data: rows, error } = await supabase
      .from('account_notices')
      .select('id, recipient_id, kind, cause, household_id, params, created_at')
      .is('dismissed_at', null)
      .gte('created_at', since.toISOString())
      // NEWEST first: a delivered notice stays undismissed (and so in this
      // window), and must not crowd the owed, recent ones out of the limit.
      .order('created_at', { ascending: false })
      .limit(MAX_NOTICES_PER_RUN);
    if (error) {
      logger.error('AccountNotices', `owed-notice lookup failed: ${error.message}`);
      return result;
    }
    const notices = (rows ?? []) as NoticeRow[];
    if (notices.length === 0) return result;

    // Already delivered: skip without claiming. (A claim would also refuse them;
    // this keeps the run from making a write per delivered notice.)
    const { data: delivered, error: deliveredError } = await supabase
      .from('notification_deliveries')
      .select('period_key')
      .eq('kind', 'account_notice')
      .in(
        'period_key',
        notices.map((n) => n.id)
      );
    if (deliveredError) {
      // Fail CLOSED: unsure what was sent, so send nothing; the cron retries.
      logger.error('AccountNotices', `delivery lookup failed: ${deliveredError.message}`);
      return result;
    }
    const done = new Set(((delivered ?? []) as { period_key: string }[]).map((d) => d.period_key));

    const byRecipient = new Map<string, NoticeRow[]>();
    for (const notice of notices) {
      if (done.has(notice.id)) continue;
      const list = byRecipient.get(notice.recipient_id) ?? [];
      list.push(notice);
      byRecipient.set(notice.recipient_id, list);
    }
    if (byRecipient.size === 0) return result;

    // Each recipient's STORED language (the push has no cookie to read).
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, preferences')
      .in('id', [...byRecipient.keys()]);
    if (profileError) {
      // Fail CLOSED: a push in the wrong language would be marked delivered and
      // never resent in the right one. Send nothing; the next run retries.
      logger.error('AccountNotices', `language lookup failed: ${profileError.message}`);
      return result;
    }
    const languageOf = new Map(
      ((profiles ?? []) as { id: string; preferences: { language?: unknown } | null }[]).map(
        (p) => [p.id, p.preferences?.language]
      )
    );

    for (const [recipient, list] of byRecipient) {
      const locale = toSupportedLocale(languageOf.get(recipient));
      // Render FIRST, then cap: a notice that cannot render must not hold one of
      // the recipient's slots on every run.
      const renderable = list.sort(byPriority).flatMap((notice) => {
        const rendered = renderAccountNotice(locale, notice);
        if (!rendered) {
          result.skipped++;
          logger.warn('AccountNotices', `notice ${notice.id} (${notice.kind}) cannot be rendered`);
          return [];
        }
        return [{ notice, rendered }];
      });
      for (const { notice, rendered } of renderable.slice(0, PUSHES_PER_RECIPIENT_PER_RUN)) {
        result.considered++;
        let claimed: boolean;
        try {
          claimed = await claimDelivery(supabase, 'account_notice', notice.id, recipient);
        } catch {
          result.notDelivered++; // claim failed closed; the next run retries
          continue;
        }
        if (!claimed) {
          result.skipped++; // another run holds it
          continue;
        }
        // Dismissed since the lookup? Never push a notice the person has closed.
        const { data: current } = await supabase
          .from('account_notices')
          .select('dismissed_at')
          .eq('id', notice.id)
          .maybeSingle();
        if (!current || (current as { dismissed_at: string | null }).dismissed_at) {
          await releaseDelivery(supabase, 'account_notice', notice.id, recipient);
          result.skipped++;
          continue;
        }
        const outcome = await dispatchCategorizedPush(recipient, 'household', {
          type: 'household_event',
          title: clip(rendered.title, PUSH_TITLE_MAX),
          body: clip(rendered.body, PUSH_BODY_MAX),
          data: { url: '/dashboard' },
        });
        if (outcome === 'sent') {
          result.sent++;
        } else {
          await releaseDelivery(supabase, 'account_notice', notice.id, recipient);
          if (outcome === 'deferred') result.deferred++;
          else result.notDelivered++;
        }
      }
    }
  } catch (error) {
    logger.error('AccountNotices', 'notice push delivery failed (non-fatal):', error);
  }
  return result;
}
