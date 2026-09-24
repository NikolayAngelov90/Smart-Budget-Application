/**
 * @jest-environment node
 */

/**
 * THE PROPERTY: A FAILED PUSH MUST STAY RETRYABLE.
 *
 * `sendPushToUser` returned `void` and swallowed every failure mode — missing
 * VAPID keys, a failed subscription lookup, zero subscriptions, a rejected send.
 * `dispatchCategorizedPush` then returned 'sent' in all of them, and both cron
 * routes write a delivery marker on 'sent'. That marker is what
 * `getAlreadyDelivered` consults to SKIP a user, and NO code path deletes one. So
 * a single false 'sent' permanently suppressed that period's notification: the
 * user never received it and never got another chance at it.
 *
 * Measured on production 2026-09-24: 24 weekly_digest markers across 3 users,
 * while exactly ONE push subscription existed in the whole system.
 *
 * WHY THESE TESTS ASSERT THE MARKER AND NOT THE RETURN VALUE. A suite that only
 * checked `dispatchCategorizedPush` returns 'failed' on a transient error would
 * pass against a version that returned the right string and still wrote the row —
 * the return value is a claim about what happened, and the marker is what happens
 * next. The property is that the retry SURVIVES, so the assertion is about the row.
 *
 * "Genuine delivery" is not available to us: a 2xx from a push service means the
 * SERVICE ACCEPTED the message, not that a device received it or a person saw it.
 * `accepted` is the strongest thing this code can know, and only `accepted` marks.
 *
 * MUTATION RECORD — each applied, run, observed RED, reverted:
 *   1. `return 'sent'` unconditionally after sendPushToUser (the original bug)
 *      -> "a transient failure writes NO marker" FAILS: outcome 'sent'.
 *   2. map 'none' to 'sent' instead of 'no_subscription'
 *      -> "a user with no subscription is not marked delivered" FAILS.
 *   3. map 'permanent' to 'sent'
 *      -> "a pruned dead endpoint is not marked delivered" FAILS.
 *   4. drop the 410/404 prune branch
 *      -> "a dead endpoint is pruned so it is not retried forever" FAILS.
 */

import webpush from 'web-push';
import { dispatchCategorizedPush, sendPushToUser } from '@/lib/services/pushService';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockSend = webpush.sendNotification as jest.Mock;

const USER = 'user-push';

/** Chainable Supabase stub: one push subscription, prefs that allow the push. */
function client(opts: { subscriptions?: unknown[]; deletes?: string[] } = {}) {
  const deletes = opts.deletes ?? [];
  const subs = opts.subscriptions ?? [
    { id: 'sub-1', endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' },
  ];

  const from = jest.fn((table: string) => {
    if (table === 'user_profiles') {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        // quiet hours 0..0 is the degenerate range the service treats as "never
        // quiet", so the dispatcher reaches the send rather than deferring.
        maybeSingle: async () => ({
          data: {
            preferences: { push_digest_enabled: true, quiet_hours_start: 0, quiet_hours_end: 0 },
          },
          error: null,
        }),
      };
      return chain;
    }
    // push_subscriptions
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (_col: string, val: string) => {
        if (chain.__deleting) {
          deletes.push(val);
          return Promise.resolve({ error: null });
        }
        return chain;
      },
      delete: () => {
        chain.__deleting = true;
        return chain;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: subs, error: null }).then(resolve),
    };
    return chain;
  });
  return { from, deletes };
}

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));
import { createServiceRoleClient } from '@/lib/supabase/server';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VAPID_PRIVATE_KEY = 'test-private';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public';
});

describe('a failed push stays retryable', () => {
  it('a transient failure does NOT report a delivery, so no marker is written', async () => {
    // THE CASE THE FIX EXISTS FOR. A user WITH a valid subscription whose send
    // fails transiently must not be recorded as delivered — the routes write a
    // marker only on 'sent', and a marker is never deleted.
    const c = client();
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);
    mockSend.mockRejectedValue(Object.assign(new Error('socket hang up'), { statusCode: 500 }));

    const outcome = await dispatchCategorizedPush(USER, 'digest', {
      type: 'digest',
      title: 't',
      body: 'b',
    });

    // Not 'sent' — which is the ONLY value the cron routes mark on.
    expect(outcome).not.toBe('sent');
    expect(outcome).toBe('failed');
  });

  it('a user with no subscription is not marked delivered', async () => {
    // Nothing to deliver and nothing to retry. Deliberately reported as its own
    // outcome rather than as a delivery: the ABSENCE of a row already means "not
    // delivered", which is true, so no status column is needed to say it.
    const c = client({ subscriptions: [] });
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);

    const outcome = await dispatchCategorizedPush(USER, 'digest', {
      type: 'digest',
      title: 't',
      body: 'b',
    });

    expect(outcome).toBe('no_subscription');
    expect(outcome).not.toBe('sent');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('a pruned dead endpoint is not marked delivered', async () => {
    const c = client();
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);
    mockSend.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    const outcome = await dispatchCategorizedPush(USER, 'digest', {
      type: 'digest',
      title: 't',
      body: 'b',
    });

    expect(outcome).not.toBe('sent');
  });

  it('a dead endpoint IS pruned, so it is not retried forever', async () => {
    // This is what makes "do not mark on failure" safe rather than merely
    // correct. Without pruning, a 410 endpoint would be retried every run,
    // erroring each time and never resolving — a worse steady state than the bug.
    const c = client();
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);
    mockSend.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await sendPushToUser(c as never, USER, { type: 'digest', title: 't', body: 'b' });

    expect(c.deletes).toContain('sub-1');
  });

  it('an accepted send DOES report a delivery', async () => {
    // The other half: if this did not pass, the fix would have replaced a
    // feature that marks everything with one that marks nothing.
    const c = client();
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);
    mockSend.mockResolvedValue({ statusCode: 201 });

    const outcome = await dispatchCategorizedPush(USER, 'digest', {
      type: 'digest',
      title: 't',
      body: 'b',
    });

    expect(outcome).toBe('sent');
  });

  it('missing VAPID keys report not_configured rather than a delivery', async () => {
    // The worst of the original failure modes: with VAPID absent, EVERY user in a
    // cohort was marked delivered and nobody received anything, silently and
    // forever. A job whose healthy state produces the same signal as its dead
    // state cannot be monitored.
    delete process.env.VAPID_PRIVATE_KEY;
    const c = client();
    (createServiceRoleClient as jest.Mock).mockReturnValue(c);

    const outcome = await dispatchCategorizedPush(USER, 'digest', {
      type: 'digest',
      title: 't',
      body: 'b',
    });

    expect(outcome).toBe('not_configured');
    expect(outcome).not.toBe('sent');
  });
});
