/**
 * @jest-environment node
 */

/**
 * THE PROPERTY, AT THE LAYER WHERE IT IS DECIDED: a failed push must leave NO
 * delivery marker, so the next run does not skip the user.
 *
 * `src/lib/services/__tests__/pushRetrySurvives.test.ts` asserts that the
 * dispatcher REPORTS the right outcome. That is necessary and not sufficient: a
 * version that returned 'failed' correctly and still wrote the row would pass it.
 * The return value is a claim about what happened; the marker is what happens
 * next, and the marker is what `getAlreadyDelivered` consults to SKIP a user.
 *
 * Since no code path anywhere deletes a marker, a single false one permanently
 * suppressed that period's notification — the user never received it and never
 * got another chance. Measured on production 2026-09-24: 24 weekly_digest markers
 * across 3 users while exactly ONE push subscription existed.
 *
 * MUTATION RECORD — applied, run, observed RED, reverted:
 *   1. `if (outcome === 'sent')` -> `if (true)` around markDelivered
 *      -> "a failed push writes no marker" FAILS (markDelivered called once).
 *   2. `if (outcome === 'sent')` -> `if (outcome !== 'suppressed')`
 *      -> same test FAILS, because 'failed' passes that predicate.
 *   3. Remove the markDelivered call entirely
 *      -> "an accepted push DOES write a marker" FAILS, so the suite cannot be
 *         satisfied by simply never marking.
 */

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    })),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/pushService', () => ({
  dispatchCategorizedPush: jest.fn(),
  isPushConfigured: jest.fn(() => true),
}));

jest.mock('@/lib/services/digestService', () => ({
  generateDigestForUser: jest.fn(),
}));

// Mocked so the MARKER ITSELF is observable. This is the whole point of the file:
// the assertion is about whether a row is written, not about what was returned.
jest.mock('@/lib/services/notificationDeliveryService', () => ({
  getAlreadyDelivered: jest.fn(),
  markDelivered: jest.fn(),
  weekPeriodKey: jest.fn(() => '2026-W39'),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('date-fns', () => ({
  startOfWeek: jest.fn(() => new Date('2026-09-21T00:00:00Z')),
  subWeeks: jest.fn(() => new Date('2026-09-14T00:00:00Z')),
}));

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { dispatchCategorizedPush } from '@/lib/services/pushService';
import { generateDigestForUser } from '@/lib/services/digestService';
import { getAlreadyDelivered, markDelivered } from '@/lib/services/notificationDeliveryService';

const mockClient = createServiceRoleClient as jest.MockedFunction<typeof createServiceRoleClient>;
const mockDispatch = dispatchCategorizedPush as jest.Mock;
const mockDigest = generateDigestForUser as jest.Mock;
const mockAlready = getAlreadyDelivered as jest.Mock;
const mockMark = markDelivered as jest.Mock;
const mockJson = NextResponse.json as jest.Mock;

const CRON_SECRET = 'test-cron-secret';
let GET: (request: Request) => Promise<unknown>;

beforeAll(async () => {
  const mod = await import('../route');
  GET = mod.GET as unknown as (request: Request) => Promise<unknown>;
});

function request() {
  return {
    headers: { get: (h: string) => (h === 'authorization' ? `Bearer ${CRON_SECRET}` : null) },
  } as unknown as Request;
}

function supabase(users: { id: string; preferences: Record<string, unknown> }[]) {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    limit: jest.fn().mockResolvedValue({ data: users, error: null }),
  };
}

const USERS = [{ id: 'user-1', preferences: { weekly_digest_enabled: true } }];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  mockJson.mockImplementation(
    (body: unknown, init?: { status?: number }) =>
      ({ status: init?.status ?? 200, json: async () => body }) as never
  );
  mockClient.mockReturnValue(supabase(USERS) as never);
  mockDigest.mockResolvedValue(undefined);
  // Nobody delivered yet — which is also what the database would say after a run
  // that correctly declined to write a marker.
  mockAlready.mockResolvedValue(new Set<string>());
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('a failed push leaves the retry intact', () => {
  it('writes NO delivery marker when the push fails', async () => {
    mockDispatch.mockResolvedValue('failed');

    const res = (await GET(request())) as { status: number };

    expect(res.status).toBe(200);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    // THE ASSERTION. A marker here is permanent — nothing deletes one — so it
    // would suppress this week's digest for this user forever.
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('writes no marker when the user has no subscription', async () => {
    mockDispatch.mockResolvedValue('no_subscription');
    await GET(request());
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('writes no marker when push is unconfigured', async () => {
    // The worst original case: every user in the cohort marked delivered while
    // nobody received anything. The route also aborts before the cohort now, but
    // this asserts the per-user path independently of that gate.
    mockDispatch.mockResolvedValue('not_configured');
    await GET(request());
    expect(mockMark).not.toHaveBeenCalled();
  });

  it('DOES write a marker when the push is accepted', async () => {
    // The other half — without this, the suite is satisfied by never marking at
    // all, which would replace "marks everything" with "marks nothing" and
    // re-send the same digest every run.
    mockDispatch.mockResolvedValue('sent');

    await GET(request());

    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockMark).toHaveBeenCalledWith(expect.anything(), 'weekly_digest', '2026-W39', 'user-1');
  });

  it('the user is processed AGAIN on the next run after a failure', async () => {
    // The property end to end. Run one fails and writes nothing; run two sees an
    // empty delivered-set — exactly what the database returns when no marker was
    // written — and processes the user again. Under the old behaviour run one
    // wrote a marker and run two would have skipped them.
    mockDispatch.mockResolvedValue('failed');
    await GET(request());
    expect(mockMark).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockJson.mockImplementation(
      (body: unknown, init?: { status?: number }) =>
        ({ status: init?.status ?? 200, json: async () => body }) as never
    );
    mockClient.mockReturnValue(supabase(USERS) as never);
    mockDigest.mockResolvedValue(undefined);
    mockAlready.mockResolvedValue(new Set<string>());
    mockDispatch.mockResolvedValue('sent');

    await GET(request());

    // Reached again, and this time the delivery is recorded.
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockMark).toHaveBeenCalledTimes(1);
  });

  it('a user who WAS delivered is skipped, so the marker still does its job', async () => {
    // Non-vacuity for the test above: it must be possible for the delivered-set
    // to cause a skip, or "processed again" proves nothing about the marker.
    mockAlready.mockResolvedValue(new Set(['user-1']));
    mockDispatch.mockResolvedValue('sent');

    await GET(request());

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockMark).not.toHaveBeenCalled();
  });
});
