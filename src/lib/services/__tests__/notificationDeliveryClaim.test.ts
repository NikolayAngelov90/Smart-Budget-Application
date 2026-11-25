/**
 * @jest-environment node
 *
 * spec-account-deletion-notifications: claim-then-send. A route's after() and
 * the daily cron can overlap, so a delivery row is CLAIMED before a push is
 * sent, and given back unless the push was delivered.
 */

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { claimDelivery, releaseDelivery } from '@/lib/services/notificationDeliveryService';
import { logger } from '@/lib/utils/logger';

describe('claimDelivery', () => {
  test('inserts the marker and reports that THIS call made it', async () => {
    const db = createSupabaseMock({
      tables: { notification_deliveries: { data: null, error: null } },
    });

    await expect(claimDelivery(db.client, 'account_notice', 'n-1', 'u-1')).resolves.toBe(true);
    expect(db.callsTo('notification_deliveries', 'insert')).toEqual([
      [{ user_id: 'u-1', kind: 'account_notice', period_key: 'n-1' }],
    ]);
  });

  test('a duplicate (unique_violation) means another run holds it: false, not an error', async () => {
    const db = createSupabaseMock({
      tables: {
        notification_deliveries: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    await expect(claimDelivery(db.client, 'account_notice', 'n-1', 'u-1')).resolves.toBe(false);
  });

  test('any other error fails CLOSED: it throws, so the caller does not send', async () => {
    const db = createSupabaseMock({
      tables: {
        notification_deliveries: { data: null, error: { code: '08006', message: 'down' } },
      },
    });
    await expect(claimDelivery(db.client, 'account_notice', 'n-1', 'u-1')).rejects.toThrow(
      'delivery claim failed'
    );
  });
});

describe('releaseDelivery', () => {
  test('deletes exactly that marker: user, kind and period', async () => {
    const db = createSupabaseMock({
      tables: { notification_deliveries: { data: null, error: null } },
    });

    await releaseDelivery(db.client, 'account_notice', 'n-1', 'u-1');

    expect(db.callsTo('notification_deliveries', 'delete')).toHaveLength(1);
    const eqs = db.callsTo('notification_deliveries', 'eq');
    expect(eqs).toContainEqual(['user_id', 'u-1']);
    expect(eqs).toContainEqual(['kind', 'account_notice']);
    expect(eqs).toContainEqual(['period_key', 'n-1']);
  });

  test('a failed release is logged, never thrown', async () => {
    const db = createSupabaseMock({
      tables: { notification_deliveries: { data: null, error: { message: 'down' } } },
    });
    await expect(
      releaseDelivery(db.client, 'account_notice', 'n-1', 'u-1')
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
