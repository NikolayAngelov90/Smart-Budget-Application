/**
 * pushService Tests — Story 12.3
 */

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import webpush from 'web-push';
import { isWithinQuietHours, sendPushToUser } from '../pushService';

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
