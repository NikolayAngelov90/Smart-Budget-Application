/**
 * pushService Tests — Story 12.3
 */

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

import webpush from 'web-push';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush, isWithinQuietHours, sendPushToUser } from '../pushService';

const mockServiceClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;

const mockSendNotification = webpush.sendNotification as jest.MockedFunction<typeof webpush.sendNotification>;

// ============================================================================
// isWithinQuietHours
// ============================================================================

describe('isWithinQuietHours', () => {
  let dateSpy: jest.SpyInstance;

  afterEach(() => {
    dateSpy?.mockRestore();
  });

  function mockHour(utcHour: number) {
    dateSpy = jest.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(utcHour);
  }

  describe('overnight range (22–08)', () => {
    it('is quiet at 22:00 (start boundary)', () => {
      mockHour(22);
      expect(isWithinQuietHours(22, 8)).toBe(true);
    });

    it('is quiet at 23:00 (within range)', () => {
      mockHour(23);
      expect(isWithinQuietHours(22, 8)).toBe(true);
    });

    it('is quiet at 00:00 (midnight)', () => {
      mockHour(0);
      expect(isWithinQuietHours(22, 8)).toBe(true);
    });

    it('is quiet at 07:00 (within range)', () => {
      mockHour(7);
      expect(isWithinQuietHours(22, 8)).toBe(true);
    });

    it('is NOT quiet at 08:00 (end boundary — exclusive)', () => {
      mockHour(8);
      expect(isWithinQuietHours(22, 8)).toBe(false);
    });

    it('is NOT quiet at 12:00 (daytime)', () => {
      mockHour(12);
      expect(isWithinQuietHours(22, 8)).toBe(false);
    });

    it('is NOT quiet at 21:00 (just before start)', () => {
      mockHour(21);
      expect(isWithinQuietHours(22, 8)).toBe(false);
    });
  });

  describe('same-day range (02–06)', () => {
    it('is quiet at 02:00 (start)', () => {
      mockHour(2);
      expect(isWithinQuietHours(2, 6)).toBe(true);
    });

    it('is quiet at 04:00 (mid range)', () => {
      mockHour(4);
      expect(isWithinQuietHours(2, 6)).toBe(true);
    });

    it('is NOT quiet at 06:00 (end — exclusive)', () => {
      mockHour(6);
      expect(isWithinQuietHours(2, 6)).toBe(false);
    });

    it('is NOT quiet at 12:00', () => {
      mockHour(12);
      expect(isWithinQuietHours(2, 6)).toBe(false);
    });
  });

  describe('degenerate range (equal start/end)', () => {
    it('never quiet when start === end', () => {
      mockHour(8);
      expect(isWithinQuietHours(8, 8)).toBe(false);
    });
  });
});

// ============================================================================
// sendPushToUser
// ============================================================================

describe('sendPushToUser', () => {
  const payload = { type: 'nudge' as const, title: 'Test', body: 'Body', data: { url: '/dashboard' } };

  const sub1 = { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'pk1', auth: 'auth1' };
  const sub2 = { id: 'sub-2', endpoint: 'https://push.example.com/2', p256dh: 'pk2', auth: 'auth2' };

  function makeSupabaseMock(subs: typeof sub1[], deleteError: unknown = null) {
    const deleteEq = jest.fn().mockResolvedValue({ error: deleteError });
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });
    return {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'push_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: subs, error: null }),
            delete: deleteFn,
          };
        }
        return {};
      }),
      _deleteFn: deleteFn,
      _deleteEq: deleteEq,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PRIVATE_KEY = 'test-private';
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public';
  });

  afterEach(() => {
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  });

  it('calls sendNotification for each subscription', async () => {
    mockSendNotification.mockResolvedValue({} as never);
    const supabase = makeSupabaseMock([sub1, sub2]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('does nothing when user has no subscriptions', async () => {
    const supabase = makeSupabaseMock([]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('deletes stale subscription on 410 response', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 410 });
    const supabase = makeSupabaseMock([sub1]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(supabase._deleteFn).toHaveBeenCalled();
    expect(supabase._deleteEq).toHaveBeenCalledWith('id', 'sub-1');
  });

  it('deletes stale subscription on 404 response', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 404 });
    const supabase = makeSupabaseMock([sub1]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(supabase._deleteFn).toHaveBeenCalled();
  });

  it('does not delete on non-410/404 errors', async () => {
    mockSendNotification.mockRejectedValue({ statusCode: 500 });
    const supabase = makeSupabaseMock([sub1]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(supabase._deleteFn).not.toHaveBeenCalled();
  });

  it('returns early without VAPID keys', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const supabase = makeSupabaseMock([sub1]);
    await sendPushToUser(supabase as never, 'user-1', payload);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});

// ============================================================================
// dispatchCategorizedPush — Story 15.5 (the single gate: AC5)
// ============================================================================

describe('dispatchCategorizedPush', () => {
  const OLD_ENV = process.env;
  let hourSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      VAPID_SUBJECT: 'mailto:test@test.dev',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
    };
    // Daytime by default (not quiet hours 22-8)
    hourSpy = jest.spyOn(Date.prototype, 'getUTCHours').mockReturnValue(12);
  });

  afterEach(() => {
    process.env = OLD_ENV;
    hourSpy?.mockRestore();
  });

  function makeGateClient(preferences: Record<string, unknown> | null, prefsError: unknown = null) {
    // Two tables hit: user_profiles (prefs) then push_subscriptions (send)
    const from = jest.fn((table: string) => {
      if (table === 'user_profiles') {
        const q: Record<string, jest.Mock> = {};
        q.select = jest.fn(() => q);
        q.eq = jest.fn(() => q);
        q.maybeSingle = jest.fn().mockResolvedValue({
          data: preferences === null ? null : { preferences },
          error: prefsError,
        });
        return q;
      }
      // push_subscriptions
      const q: Record<string, jest.Mock> = {};
      q.select = jest.fn(() => q);
      q.eq = jest.fn(() => q);
      (q as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
        resolve({
          data: [{ id: 's1', endpoint: 'https://e/1', p256dh: 'k', auth: 'a' }],
          error: null,
        });
      return q;
    });
    return { from };
  }

  const payload = {
    type: 'achievement' as const,
    title: 'Achievement unlocked!',
    body: 'First Step',
    data: { url: '/settings' },
  };

  it("sends when the category is enabled (explicit flag) and returns 'sent'", async () => {
    mockServiceClient.mockReturnValue(makeGateClient({ push_milestones_enabled: true }) as never);
    await expect(dispatchCategorizedPush('u-1', 'milestones', payload)).resolves.toBe('sent');
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });

  it("does NOT send when the category flag is off and returns 'suppressed'", async () => {
    mockServiceClient.mockReturnValue(makeGateClient({ push_milestones_enabled: false }) as never);
    await expect(dispatchCategorizedPush('u-1', 'milestones', payload)).resolves.toBe('suppressed');
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('defaults: milestones/household/digest ON, nudges/reengagement opt-in OFF', async () => {
    mockServiceClient.mockReturnValue(makeGateClient({}) as never);
    expect(await dispatchCategorizedPush('u-1', 'milestones', payload)).toBe('sent');
    expect(await dispatchCategorizedPush('u-1', 'household', payload)).toBe('sent');
    expect(await dispatchCategorizedPush('u-1', 'digest', payload)).toBe('sent');
    expect(mockSendNotification).toHaveBeenCalledTimes(3);

    mockSendNotification.mockClear();
    expect(await dispatchCategorizedPush('u-1', 'nudges', payload)).toBe('suppressed');
    expect(await dispatchCategorizedPush('u-1', 'reengagement', payload)).toBe('suppressed');
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('respects quiet hours for EVERY category', async () => {
    hourSpy.mockReturnValue(23); // inside default 22-8
    // All flags explicitly ON so only quiet hours can suppress
    mockServiceClient.mockReturnValue(
      makeGateClient({
        push_nudges_enabled: true,
        push_milestones_enabled: true,
        push_household_enabled: true,
        push_digest_enabled: true,
        push_reengagement_enabled: true,
      }) as never
    );
    const categories = ['nudges', 'milestones', 'household', 'digest', 'reengagement'] as const;
    for (const category of categories) {
      expect(await dispatchCategorizedPush('u-1', category, payload)).toBe('suppressed');
    }
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("suppresses ACHIEVEMENT pushes when gamification is opted out (Story 15.6)", async () => {
    mockServiceClient.mockReturnValue(
      makeGateClient({ push_milestones_enabled: true, gamification_enabled: false }) as never
    );
    await expect(dispatchCategorizedPush('u-1', 'milestones', payload)).resolves.toBe('suppressed');
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('achievement pushes still send when the gamification flag is absent (default on)', async () => {
    mockServiceClient.mockReturnValue(makeGateClient({ push_milestones_enabled: true }) as never);
    await expect(dispatchCategorizedPush('u-1', 'milestones', payload)).resolves.toBe('sent');
  });

  it("non-achievement 'milestones' pushes (shared-goal milestone) are UNAFFECTED by the gamification flag", async () => {
    mockServiceClient.mockReturnValue(
      makeGateClient({ push_milestones_enabled: true, gamification_enabled: false }) as never
    );
    const goalMilestone = {
      type: 'milestone' as const,
      title: '50% reached!',
      body: '"Vacation" just passed 50% of its target.',
      data: { url: '/household' },
    };
    await expect(dispatchCategorizedPush('u-1', 'milestones', goalMilestone)).resolves.toBe('sent');
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });

  it("prefs read failure -> no send, never throws, returns 'failed' (unknowable != consent)", async () => {
    mockServiceClient.mockReturnValue(makeGateClient(null, { message: 'boom' }) as never);
    await expect(dispatchCategorizedPush('u-1', 'household', payload)).resolves.toBe('failed');
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("internal errors are swallowed and return 'failed' (best-effort by policy)", async () => {
    mockServiceClient.mockImplementation(() => {
      throw new Error('no client');
    });
    await expect(dispatchCategorizedPush('u-1', 'digest', payload)).resolves.toBe('failed');
  });
});
