/**
 * @jest-environment node
 *
 * AUTOMATIC INSIGHT GENERATION — the trigger that never ran.
 *
 * THE DEFECT. `POST /api/transactions` created the trigger promise and did not
 * await it ("This is non-blocking - we don't wait for it to complete"), and
 * `checkAndTriggerForTransactionCount` then detached `generateInsights` the same
 * way. On Vercel the function freezes once the response is sent, so the work was
 * usually dropped. Measured in production 2026-09-17: the 10-transaction
 * threshold was crossed at 18:27 the previous evening AND again at 05:54 that
 * morning, and the run marker never moved off 2026-09-10. Two opportunities,
 * neither completed. The user opened the app to an empty page.
 *
 * It had never worked. The pre-hp-8 cold start regenerated on nearly every
 * transaction, so the redundant path masked the intended one — fixing the
 * regeneration bug is what revealed that automatic generation was broken.
 *
 * WHY A SHAPE TEST WOULD BE WORTHLESS HERE. "The promise is awaited" is exactly
 * what the old code looked like it did. Under jest nothing freezes, so a bare
 * fire-and-forget also completes — the defect is invisible to any test that runs
 * the function and watches it finish. So these assert the EFFECT: given the
 * conditions, does a generation actually happen, and given the wrong conditions,
 * does it stay away.
 *
 * The production acceptance test is the one that counts and cannot live here:
 * enter the tenth transaction and watch a row appear without pressing anything.
 */

import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const USER = 'user-trigger';

/**
 * EXPLICIT DATES, because the clock is now a parameter.
 *
 * These used to be `Date.now() - N * DAY`, which is correct but says "five days
 * before whenever this runs" rather than naming the two moments being compared.
 * With an injected clock a test can state both ends, the way streakEngine's do
 * (`advanceStreak(prev, '2026-01-06')`), and a reader can check the arithmetic
 * without computing it.
 */
/**
 * DELIBERATELY NOT TODAY. The first version of this used the date the tests were
 * written, and mutation testing caught it: replacing the injected `now` with
 * `Date.now()` left all six GREEN, because the injected clock and the real one
 * agreed. The injection was untested by the tests written to prove it.
 *
 * A fixed date in the PAST can never coincide with the real clock — time only
 * moves forward — so the discrimination holds permanently and strengthens with
 * age, which is the opposite of how the hp-8 fixture behaved.
 */
const NOW = new Date('2026-03-15T12:00:00.000Z');
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

/** The marker value the service reads, and the transaction count it sees. */
function mockEnvironment(lastGenerated: string | null, newTransactionCount: number) {
  const profileChain: Record<string, unknown> = {
    select: jest.fn(() => profileChain),
    eq: jest.fn(() => profileChain),
    maybeSingle: jest
      .fn()
      .mockResolvedValue({ data: { insights_last_generated_at: lastGenerated }, error: null }),
  };

  const txChain: Record<string, unknown> = {
    select: jest.fn(() => txChain),
    eq: jest.fn(() => txChain),
    gte: jest.fn(() => Promise.resolve({ count: newTransactionCount, error: null, data: [] })),
  };

  (createClient as jest.Mock).mockResolvedValue({
    from: jest.fn((table: string) => (table === 'transactions' ? txChain : profileChain)),
  });

  return { txChain };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('shouldTriggerGeneration — when insights are due', () => {
  it('fires on the tenth transaction since the last run', async () => {
    // The boundary asserted directly: Story 6.5 says 10+, and an off-by-one here
    // costs a low-volume user an entire extra cycle.
    mockEnvironment(daysBefore(1), 10);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(true);
  });

  it('does not fire on the ninth with a recent run', async () => {
    mockEnvironment(daysBefore(1), 9);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(false);
  });

  it('fires on ONE transaction when the last run is stale', async () => {
    // THE LOW-VOLUME PATH. A pure count cannot serve someone logging a few
    // expenses a week: at that rate the tenth transaction can be a month away.
    // Time is the only condition that scales down.
    mockEnvironment(daysBefore(5), 1);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(true);
  });

  it('a dormant account is not regenerated over unchanged data', async () => {
    // Stale marker, but nothing new to say. Regenerating here would rewrite the
    // same insights forever and bump updated_at for no reason.
    mockEnvironment(daysBefore(90), 0);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(false);
  });

  it('does not fire one day short of the staleness window', async () => {
    // The boundary the injected clock makes expressible: 2 days is inside the
    // 3-day window, so one new transaction is not yet enough. Stating both
    // moments explicitly is what lets a reader check this without arithmetic.
    mockEnvironment(daysBefore(2), 1);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(false);
  });

  it('a NULL marker never reaches the staleness condition', async () => {
    // hp-8 IN A NEW COSTUME. "Null is very old" is the obvious reading, and it
    // makes every user permanently overdue — generation firing on every single
    // transaction, which is the original bug. NULL means "never generated" and
    // is answered by the count path, which returns true once; the run that
    // follows writes the marker.
    //
    // The discriminator is that it answers WITHOUT consulting the count: with 0
    // new transactions the staleness rule would say false, and a "null is old"
    // reading would say true only by treating null as a date. So: true, and the
    // transaction table is never queried.
    const { txChain } = mockEnvironment(null, 0);
    const { shouldTriggerGeneration } = await import('@/lib/services/insightService');

    await expect(shouldTriggerGeneration(USER, NOW)).resolves.toBe(true);
    expect(txChain.gte).not.toHaveBeenCalled();
  });
});
