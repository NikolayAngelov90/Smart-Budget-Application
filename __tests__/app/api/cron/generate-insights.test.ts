/**
 * Tests for Cron Job Endpoint - Generate Insights
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC2: Scheduled Job - Daily at midnight UTC, checks for new month
 *
 * ==========================================================================
 * TWO FALSE GREENS FOUND HERE 2026-10-08, and BOTH are repeats of classes
 * already documented in docs/testing-guidelines.md.
 * ==========================================================================
 *
 * 1. ORDER-DEPENDENT (`clearAllMocks` leaves IMPLEMENTATIONS - 2nd repeat).
 *    `should process users if 1st of month` set up no Supabase mock at all -
 *    its body said "Mock Supabase and service will be needed here" and was
 *    never finished. It passed on jest.setup.js's GLOBAL `createClient`
 *    default. Two later tests in this file call
 *    `createClient.mockResolvedValue(...)`, and `clearAllMocks()` clears
 *    recorded CALLS while leaving the implementation in place, so under
 *    `--randomize` the error client leaks forward:
 *
 *      seeds 3, 4 and 5 of 8: `should return 500 on database error` runs
 *      FIRST and the 1st-of-month test then gets a 500 instead of its 200.
 *
 *    The fix is not `resetAllMocks()` - that would strip the implementation
 *    jest.setup.js's own `jest.fn(async () => ...)` factory supplies, and
 *    break every other file that relies on the default. Instead: the default
 *    implementation is CAPTURED at module load and restored in `beforeEach`,
 *    which does not depend on any `mockReset` semantics; and every test that
 *    touches Supabase now establishes its own client, so each is usable alone.
 *
 *    WHICH OF THOSE TWO ACTUALLY FIXES IT: the per-test setup. Deleting the
 *    `beforeEach` restoration came back GREEN in declaration order and across
 *    eight randomized seeds, because no test depends on the default any more.
 *    The restoration line is therefore defence for a FUTURE test added without
 *    its own client - and an undetectable guard is the kind that rots, so
 *    `beforeEach restores the global createClient default` below makes it
 *    detectable. With that test present, deleting the line reddens.
 *
 * 2. THE TEST NAME WAS FALSE, which is the more interesting half. "should
 *    process users" asserted only `status === 200` and `skipped === false`.
 *    It never asserted that a single user was processed, and could not have -
 *    the global default returns no users. It now mocks the service and asserts
 *    `usersProcessed` and `insightsGenerated`, which is what the name claims.
 *
 * 3. `should return 500 on database error` GOT ITS 500 FROM THE WRONG PLACE
 *    (chain-mock class - 4th occurrence). Its mock was
 *    `{ from: mockReturnThis(), select: mockResolvedValue({ error }) }`, but
 *    the route calls `.from(...).select(...).limit(1000)`. `select` resolved to
 *    a Promise, which has no `.limit`, so the 500 came from
 *
 *      TypeError: supabase.from(...).select(...).limit is not a function
 *
 *    - proven by reading `data.details`, not inferred. The route's
 *    `if (usersError) throw usersError` branch had never been exercised. The
 *    chain is now complete AND the test asserts on `details`, so a regression
 *    to a malformed mock reddens instead of passing.
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/generate-insights/route';
import { createClient } from '@/lib/supabase/server';
import { generateInsights } from '@/lib/services/insightService';
import { mockSupabaseClient } from '../../../setup/supabase-mock';

jest.mock('@/lib/services/insightService', () => ({
  generateInsights: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGenerateInsights = generateInsights as jest.MockedFunction<typeof generateInsights>;

/**
 * jest.setup.js mocks `createClient` as `jest.fn(async () => mockSupabaseClient)`.
 * Captured HERE, at module load, before any test can overwrite it - restoring it
 * in `beforeEach` is what stops one test's `mockResolvedValue` leaking into the
 * next, without `resetAllMocks()` destroying the factory's implementation.
 */
const DEFAULT_CREATE_CLIENT = mockCreateClient.getMockImplementation();

/**
 * The real chain: `.from(table).select(cols).limit(n)`. All three, or the route
 * throws a TypeError and the test passes for the wrong reason.
 */
const supabaseReturning = (result: { data: unknown; error: unknown }) => {
  const limit = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ select });
  return { client: { from } as never, from, select, limit };
};

// Tests for POST /api/cron/generate-insights
describe('POST /api/cron/generate-insights', () => {
  const MOCK_CRON_SECRET = 'test-cron-secret';

  beforeEach(() => {
    // Set environment variable
    process.env.CRON_SECRET = MOCK_CRON_SECRET;
    jest.clearAllMocks();
    // clearAllMocks clears CALLS, not IMPLEMENTATIONS. Without this line a
    // mockResolvedValue set by any test above survives into every test below.
    mockCreateClient.mockImplementation(DEFAULT_CREATE_CLIENT!);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('Authentication', () => {
    it('should return 401 if no authorization header provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if incorrect secret provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept valid cron secret', async () => {
      // Mock date to NOT be 1st of month to skip processing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15'));

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);

      jest.useRealTimers();
    });
  });

  describe('Mock hygiene', () => {
    // No apostrophe in this name, deliberately. `jest -t` takes a REGEX and the
    // extractors in this repo read test names out of source; a quote or a
    // parenthesis in a name is how one of them silently addressed nothing.
    it('beforeEach restores the global createClient default, so no test inherits the client of another', async () => {
      // THE GUARD FOR THE beforeEach LINE, which is otherwise undetectable.
      // `jest.clearAllMocks()` clears recorded CALLS and leaves IMPLEMENTATIONS,
      // so a `mockResolvedValue` set by any test in this file survives into
      // every test after it. This test sets up nothing and asserts it is handed
      // the SHARED default client - under `--randomize` it runs after the tests
      // that override `createClient`, so without the restoration it would be
      // handed their client instead and this identity check fails.
      await expect(createClient()).resolves.toBe(mockSupabaseClient);
    });
  });

  describe('New Month Detection', () => {
    it('should skip processing if NOT 1st of month', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15')); // 15th of month

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.skipped).toBe(true);
      expect(data.reason).toContain('Not start of month');
      expect(data.usersProcessed).toBe(0);

      jest.useRealTimers();
    });

    it('should process users if 1st of month', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01')); // 1st of month

      // ESTABLISHES ITS OWN PRECONDITION. This test previously set up nothing
      // and rode jest.setup.js's global default, which is why reordering the
      // file broke it and why it never asserted that a user was processed.
      const { client, from, select, limit } = supabaseReturning({
        data: [{ id: 'user-a' }, { id: 'user-b' }],
        error: null,
      });
      mockCreateClient.mockResolvedValue(client);
      mockGenerateInsights.mockResolvedValue([{}, {}, {}] as never);

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.skipped).toBe(false);

      // WHAT THE NAME CLAIMS, which it never used to assert. Both users are
      // processed and the per-user insight counts are summed.
      expect(data.usersProcessed).toBe(2);
      expect(data.totalUsers).toBe(2);
      expect(data.insightsGenerated).toBe(6);
      expect(data.errorCount).toBe(0);

      // And the RIGHT users, not merely two calls. An arg-blind assertion is
      // how a scoping bug survives a green test.
      expect(mockGenerateInsights).toHaveBeenCalledWith('user-a', false);
      expect(mockGenerateInsights).toHaveBeenCalledWith('user-b', false);

      // The query is scoped as the route documents it.
      expect(from).toHaveBeenCalledWith('user_profiles');
      expect(select).toHaveBeenCalledWith('id');
      expect(limit).toHaveBeenCalledWith(1000);

      jest.useRealTimers();
    });
  });

  describe('Batch Processing', () => {
    it('should handle empty user list gracefully', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01'));

      // Mock returning no users
      mockCreateClient.mockResolvedValue(supabaseReturning({ data: [], error: null }).client);

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usersProcessed).toBe(0);
      // Zero users must mean the service was never CALLED, not that it was
      // called and returned nothing.
      expect(mockGenerateInsights).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01'));

      // THE WHOLE CHAIN. With `from: mockReturnThis()` and `select` resolving
      // straight to the result, `.limit` was undefined and this test's 500 came
      // from a TypeError rather than from the error it sets up.
      mockCreateClient.mockResolvedValue(
        supabaseReturning({ data: null, error: new Error('Database connection failed') }).client
      );

      const request = new NextRequest('http://localhost:3000/api/cron/generate-insights', {
        headers: {
          authorization: `Bearer ${MOCK_CRON_SECRET}`,
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);

      // WHICH 500. The route echoes `error.message`, so this distinguishes the
      // `if (usersError) throw usersError` branch from a malformed mock that
      // throws a TypeError on the way there. Without it the test passes either
      // way - and for this file's whole life, it was the TypeError.
      expect(data.details).toBe('Database connection failed');
      expect(data.details).not.toMatch(/is not a function/);

      jest.useRealTimers();
    });
  });
});
