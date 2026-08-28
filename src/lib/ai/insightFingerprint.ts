/**
 * The stable identity of the CLAIM an insight makes — hp-10.
 *
 * Generation used to `delete` every row for the user and reinsert, so a
 * dismissal survived exactly until the next run. Observed in production: one
 * account with 12 rows sharing a single `created_at` to the microsecond and ZERO
 * dismissed; another whose 6 dismissed rows went to 0 in one regeneration.
 *
 * A fingerprint lets the same claim UPDATE its row instead of minting a new one,
 * so `is_dismissed` survives. Getting the granularity right is the whole design:
 * too coarse and two different claims collide; too fine and every run mints a
 * fresh row beside the dismissed one, which looks identical to the user.
 */

import type { InsightInsert, InsightMetadata } from '@/types/database.types';

/** `YYYY-MM` for the month an insight's claim is about. */
export function monthBucket(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute the fingerprint for one insight.
 *
 * PER-TYPE, and each choice is deliberate:
 *
 * `unusual_expense` — keyed on `transaction_id` ALONE.
 *   Its dismissal is permanent and anchored to one transaction, so it must never
 *   return on any later run. Crucially the AMOUNT and DATE are excluded: the user
 *   dismissed "I know about this purchase", not "I know about this number", so
 *   editing the transaction must not resurrect the card.
 *
 * `spending_anomaly`, `new_high_spend_category` — `category_id` + the month the
 *   claim is ABOUT. Read from the engines rather than copied from the others:
 *   `detectSpendingAnomalies` compares the current month against `mean(m1, m2)`,
 *   and `detectNewHighSpendCategories` compares the current month's top-3
 *   against the prior two months' top-5. The WINDOW rolls as months advance, but
 *   each individual claim is scoped to m0 — "groceries are up 40% THIS MONTH" is
 *   a statement about August, and September's is a different claim the user has
 *   not dismissed.
 *
 *   The two-month BASELINE is deliberately excluded. It shifts whenever a late
 *   transaction lands in m1 or m2, so keying on it would remint the row on
 *   trivial data changes — drift that silently restores the old behaviour while
 *   looking fixed.
 *
 * everything else — `category_id` + month, same reasoning.
 *
 * `rule_version` is NEVER part of the key. A change to the wording of a rule
 * must not resurrect a dismissal.
 */
export function fingerprintFor(insight: InsightInsert, currentMonth: Date): string | null {
  const metadata = (insight.metadata ?? {}) as InsightMetadata;
  const bucket = monthBucket(currentMonth);

  if (insight.type === 'unusual_expense') {
    const transactionId = metadata.transaction_id;
    // No transaction id means no stable identity. `fingerprint` is NOT NULL in
    // the schema, so such a row cannot be written at all — the caller logs it at
    // ERROR rather than dropping it quietly. Unreachable in practice: every
    // unusual_expense carries the transaction it is about.
    return transactionId ? `unusual_expense:tx:${transactionId}` : null;
  }

  const categoryId = metadata.category_id;
  if (!categoryId) return null;

  return `${insight.type}:cat:${categoryId}:${bucket}`;
}

/**
 * Fields an UPSERT is allowed to overwrite.
 *
 * THIS LIST IS THE FIX. An upsert that refreshed the whole row would reset
 * `is_dismissed` and rebuild the original bug through a different door — the
 * dismissal would survive the DELETE only to be overwritten by the UPDATE.
 *
 * Excluded, and each for its own reason:
 *   is_dismissed, dismissed_at  the user's decision; the entire point
 *   view_count, first_viewed_at, last_viewed_at,
 *   metadata_expanded_count, last_metadata_expanded_at
 *                              engagement history, destroyed on every run until
 *                              now, which is why there is none worth keeping
 *   created_at                 when the claim was FIRST made, not last refreshed
 *   id, user_id, fingerprint   identity
 */
export const UPSERT_UPDATABLE_FIELDS = [
  'title',
  'description',
  'priority',
  'metadata',
] as const;

// `updated_at` is NOT here and is NOT written by the application. A BEFORE
// UPDATE trigger sets it from the DATABASE clock. If the app wrote it instead,
// the sweep would compare an app-server timestamp against a database watermark,
// and a lambda whose clock ran behind Postgres would write rows the sweep
// immediately deleted.

/** Narrow an insight to the fields an upsert may overwrite, plus its identity. */
export function toUpsertRow(
  insight: InsightInsert,
  fingerprint: string
): Record<string, unknown> {
  return {
    user_id: insight.user_id,
    type: insight.type,
    fingerprint,
    title: insight.title,
    description: insight.description,
    priority: insight.priority,
    metadata: insight.metadata,
    // `is_dismissed` is NOT set here. On insert the column default (false)
    // applies; on conflict it is left untouched, which is what preserves a
    // dismissal across regeneration.
  };
}
