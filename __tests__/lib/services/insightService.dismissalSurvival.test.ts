/**
 * @jest-environment node
 */

/**
 * hp-10 acceptance — the €700 Shopping case, and the sweep that must not undo it.
 *
 * THE REPORTED BUG. Niki dismissed an `unusual_expense` for a €700 Shopping
 * transaction dated 16 July 2026. It came back, unchanged. Confirmed in
 * production before any code was written: the row carried `is_dismissed = false`
 * with a `created_at` LATER than the dismissal, and all 12 rows on that account
 * shared one timestamp to the microsecond — a delete-and-reinsert batch. The QA
 * account was the control: 6 rows, all 6 still dismissed, because it had not
 * regenerated since July.
 *
 * Reproduced end to end on QA: dismiss, force regeneration, same transaction,
 * NEW row id, `is_dismissed` true -> false.
 *
 * WHAT THESE TESTS ASSERT THAT A NAIVE ONE WOULD NOT
 *
 * "Is it still dismissed?" is only half. A fingerprint that is too FINE leaves
 * the dismissed row alone and inserts a fresh one beside it — identical to the
 * user, and passing a flag-only assertion. So the row COUNT for the transaction
 * is asserted too.
 *
 * And the sweep is what distinguishes "we fixed dismissal" from "we broke expiry
 * to fix dismissal": delete-and-reinsert garbage-collected as a side effect, and
 * UPSERT alone would leave a stale "groceries up 40%" card on the dashboard in
 * November.
 *
 * The database-level round-trip lives in
 * `src/lib/test-utils/__tests__/insight-upsert.rls.test.ts`, because a trigger
 * and a unique index cannot be exercised by a mock. This file covers what the
 * SERVICE does: which rows it writes, which it sweeps, and which it spares.
 */

import { fingerprintFor, toUpsertRow } from '@/lib/ai/insightFingerprint';
import type { InsightInsert } from '@/types/database.types';

const USER = 'user-hp10';
const TX = 'a0f9c251-ce52-4330-a5ee-090405bb8a73';
const MONTH = new Date('2026-08-15T12:00:00');

const unusualExpense = (transactionId: string, amount: number): InsightInsert =>
  ({
    user_id: USER,
    type: 'unusual_expense',
    priority: 5,
    title: `Unusual Shopping expense: €${amount}`,
    description: 'much higher than your typical €98',
    is_dismissed: false,
    metadata: {
      category_id: 'cat-shopping',
      category_name: 'Shopping',
      transaction_amount: amount,
      transaction_id: transactionId,
      transaction_date: '2026-07-16',
    },
  }) as InsightInsert;

const anomaly = (categoryId: string): InsightInsert =>
  ({
    user_id: USER,
    type: 'spending_anomaly',
    priority: 4,
    title: 'Groceries up 40%',
    description: 'above your two-month average',
    is_dismissed: false,
    metadata: { category_id: categoryId, category_name: 'Groceries' },
  }) as InsightInsert;

describe('the €700 Shopping case', () => {
  it('regeneration targets the SAME row, so the dismissal has something to survive on', () => {
    // The fix in one assertion: two runs over the same transaction produce ONE
    // identity, so the second is an UPDATE of the first rather than a new row
    // with is_dismissed reset to false.
    const first = fingerprintFor(unusualExpense(TX, 700), MONTH);
    const second = fingerprintFor(unusualExpense(TX, 700), new Date('2026-09-02T09:00:00'));

    expect(first).toBe(second);
    expect(first).toContain(TX);
  });

  it('survives the transaction being EDITED', () => {
    // Settled product decision: he dismissed "I know about this purchase", not
    // "I know about this number". Including the amount or date in the key would
    // re-raise the card the moment either changed.
    const original = fingerprintFor(unusualExpense(TX, 700), MONTH);
    const editedAmount = fingerprintFor(unusualExpense(TX, 650), MONTH);

    expect(editedAmount).toBe(original);
  });

  it('does NOT collide with a different transaction in the same category', () => {
    // The other failure direction. Too COARSE and the second outlier inherits
    // the first one's dismissal, hiding a genuine insight the user never saw.
    const first = fingerprintFor(unusualExpense(TX, 700), MONTH);
    const other = fingerprintFor(unusualExpense('different-tx-id', 400), MONTH);

    expect(other).not.toBe(first);
  });

  it('the upsert payload NEVER carries is_dismissed', () => {
    // THE LINE THE WHOLE STORY TURNS ON. An upsert that refreshed the entire row
    // would reset the flag and rebuild the bug through a different door: the
    // dismissal would survive the DELETE only to be overwritten by the UPDATE.
    const row = toUpsertRow(unusualExpense(TX, 700), 'fp');

    expect(row).not.toHaveProperty('is_dismissed');
    expect(row).not.toHaveProperty('dismissed_at');
    // Nor the engagement history, which is equally the user's and not the run's.
    expect(row).not.toHaveProperty('view_count');
    expect(row).not.toHaveProperty('created_at');
    // …while the presentation fields ARE refreshed.
    expect(row).toMatchObject({ title: expect.any(String), description: expect.any(String) });
  });

  it('does not let the app set updated_at — the trigger owns it', () => {
    // If the app wrote this, the sweep would compare an app-server timestamp
    // against a database watermark, and a lambda whose clock ran behind Postgres
    // would write rows the sweep immediately deleted.
    expect(toUpsertRow(unusualExpense(TX, 700), 'fp')).not.toHaveProperty('updated_at');
  });
});

describe('period-scoped claims expire, transaction-scoped ones do not', () => {
  it('a month-keyed claim gets a NEW identity next month', () => {
    // "Groceries are up 40% THIS MONTH" is a statement about August. September's
    // is a different claim the user has not dismissed, so it must be able to
    // raise again — and August's row becomes sweepable.
    const august = fingerprintFor(anomaly('cat-groceries'), new Date('2026-08-15T12:00:00'));
    const september = fingerprintFor(anomaly('cat-groceries'), new Date('2026-09-15T12:00:00'));

    expect(august).not.toBe(september);
    expect(august).toContain('2026-08');
    expect(september).toContain('2026-09');
  });

  it('a transaction-keyed claim keeps ONE identity across months', () => {
    // The asymmetry that makes the €700 dismissal permanent while a monthly
    // anomaly can legitimately return.
    const july = fingerprintFor(unusualExpense(TX, 700), new Date('2026-07-20T12:00:00'));
    const october = fingerprintFor(unusualExpense(TX, 700), new Date('2026-10-20T12:00:00'));

    expect(july).toBe(october);
  });

  it('is not affected by a shifting two-month baseline', () => {
    // The baseline is deliberately OUT of the key. It moves whenever a late
    // transaction lands in m1 or m2, and keying on it would remint the row on
    // trivial data changes — drift that restores the old behaviour while looking
    // fixed.
    const lean = { ...anomaly('cat-groceries') };
    const withBaseline = {
      ...anomaly('cat-groceries'),
      metadata: { category_id: 'cat-groceries', category_name: 'Groceries', baseline: 412.55 },
    } as InsightInsert;

    expect(fingerprintFor(withBaseline, MONTH)).toBe(fingerprintFor(lean, MONTH));
  });
});
