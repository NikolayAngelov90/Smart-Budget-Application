/**
 * /api/households/members (GET) + /[userId] (DELETE) — Story 13.11
 */

/**
 * @jest-environment node
 */

// `after()` RECORDS its callback (spec-account-deletion-notifications): the tests
// assert the notice push is scheduled, and run it to see what it calls.
jest.mock('next/server', () => ({
  after: jest.fn(),
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/services/householdMemberService', () => ({
  listHouseholdMembers: jest.fn(),
  removeMember: jest.fn(),
  CannotRemoveSelfError: class CannotRemoveSelfError extends Error {},
  MemberNotFoundError: class MemberNotFoundError extends Error {},
}));
jest.mock('@/lib/services/invitationService', () => ({
  NotHouseholdAdminError: class NotHouseholdAdminError extends Error {},
}));
jest.mock('@/lib/services/accountNoticeService', () => ({
  deliverAccountNoticePushes: jest.fn().mockResolvedValue({}),
  NOTICE_CLOCK_SKEW_MS: 60_000,
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { createClient } from '@/lib/supabase/server';
import {
  listHouseholdMembers,
  removeMember,
  CannotRemoveSelfError,
  MemberNotFoundError,
} from '@/lib/services/householdMemberService';
import { NotHouseholdAdminError } from '@/lib/services/invitationService';
import { after } from 'next/server';
import { deliverAccountNoticePushes } from '@/lib/services/accountNoticeService';
import { GET } from '../route';
import { DELETE } from '../[userId]/route';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockList = listHouseholdMembers as jest.MockedFunction<typeof listHouseholdMembers>;
const mockRemove = removeMember as jest.MockedFunction<typeof removeMember>;

function authClient(user: object | null) {
  return {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user }, error: user ? null : { message: 'no' } }),
    },
  };
}
const params = Promise.resolve({ userId: 'target' });

beforeEach(() => jest.clearAllMocks());

describe('GET /api/households/members', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await GET()).status).toBe(401);
  });
  it('returns the roster', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockList.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});

describe('DELETE /api/households/members/[userId]', () => {
  it('401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(authClient(null) as never);
    expect((await DELETE({} as never, { params })).status).toBe(401);
  });
  it('removes a member (200)', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockResolvedValue(undefined);
    const res = await DELETE({} as never, { params });
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith('admin', 'target');
  });
  it('400 when removing self', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockRejectedValue(new CannotRemoveSelfError());
    expect((await DELETE({} as never, { params })).status).toBe(400);
  });
  it('403 when not an admin', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'u' }) as never);
    mockRemove.mockRejectedValue(new NotHouseholdAdminError());
    expect((await DELETE({} as never, { params })).status).toBe(403);
  });
  it('404 when the target is not a member', async () => {
    mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
    mockRemove.mockRejectedValue(new MemberNotFoundError());
    expect((await DELETE({} as never, { params })).status).toBe(404);
  });

  describe("account notices: the owner's push goes out AFTER the response", () => {
    const mockAfter = after as unknown as jest.Mock;
    const mockDeliver = deliverAccountNoticePushes as jest.Mock;
    beforeEach(() => {
      mockAfter.mockClear();
      mockDeliver.mockClear();
    });

    it('a successful removal schedules delivery after the response, scoped to notices since the request began', async () => {
      mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
      mockRemove.mockResolvedValue(undefined);
      const before = Date.now();

      const res = await DELETE({} as never, { params });
      const afterCall = Date.now();

      expect(res.status).toBe(200);
      expect(mockAfter).toHaveBeenCalledTimes(1);
      // Scheduled once the removal SUCCEEDED (its transaction wrote the notices)...
      expect(mockRemove.mock.invocationCallOrder[0]!).toBeLessThan(
        mockAfter.mock.invocationCallOrder[0]!
      );
      // ...and nothing was delivered inside the request.
      expect(mockDeliver).not.toHaveBeenCalled();

      await (mockAfter.mock.calls[0]![0] as () => Promise<unknown>)();
      expect(mockDeliver).toHaveBeenCalledTimes(1);
      const since = (mockDeliver.mock.calls[0]![0] as { since: Date }).since.getTime();
      // since = request start - 60s, and the request started inside [before, afterCall].
      expect(since).toBeGreaterThanOrEqual(before - 60_000);
      expect(since).toBeLessThanOrEqual(afterCall - 60_000);
    });

    it.each([
      ['the removal fails', () => mockRemove.mockRejectedValue(new Error('x')), 500],
      [
        'the caller is not an admin',
        () => mockRemove.mockRejectedValue(new NotHouseholdAdminError()),
        403,
      ],
      [
        'the target is not a member',
        () => mockRemove.mockRejectedValue(new MemberNotFoundError()),
        404,
      ],
    ])(
      'schedules NOTHING when %s (no notice was written, and no scan for a refused caller)',
      async (_l, arrange, status) => {
        mockCreateClient.mockResolvedValue(authClient({ id: 'admin' }) as never);
        arrange();

        const res = await DELETE({} as never, { params });

        expect(res.status).toBe(status);
        expect(mockAfter).not.toHaveBeenCalled();
      }
    );

    it('schedules nothing for an unauthenticated request', async () => {
      mockCreateClient.mockResolvedValue(authClient(null) as never);
      await DELETE({} as never, { params });
      expect(mockAfter).not.toHaveBeenCalled();
    });
  });
});
