/**
 * @jest-environment jsdom
 */

/**
 * The engagement tracking guard.
 *
 * WHY THIS SUITE EXISTS. `POST /api/insights/:id/track` shipped in Epic 6 and
 * nothing called it for the entire life of the product. Every one of the five
 * engagement columns was empty on every row ever written, and a second fault hid
 * the first: `authenticated` had no UPDATE grant on those columns either, so
 * wiring the client alone would have produced the same empty table and read as
 * "users do not engage". Both faults were invisible because telemetry fails
 * silently by design.
 *
 * So the thing to guard is not "does the function work" — it did, in isolation,
 * for months. It is that the CALL still happens and the outcome is HONEST.
 *
 * MUTATION RECORD — each applied, run, observed RED, then reverted. Counts are
 * what jest actually reported, not what I expected it to report:
 *   1. Delete `recorded.add(key)`                        -> 2 failed / 4 passed
 *   2. Skip the `res.ok` check, always return 'tracked'  -> 2 failed / 4 passed
 *   3. Drop `recorded.delete(key)` on the failure path   -> 1 failed / 5 passed
 *   4. Post to `/api/analytics/track` instead            -> 1 failed / 5 passed
 * Restored: 6 passed / 6 total.
 */

import {
  trackInsightEngagement,
  __resetEngagementTrackingForTest,
} from '../insightEngagementService';

const mockFetch = jest.fn();

beforeEach(() => {
  __resetEngagementTrackingForTest();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('trackInsightEngagement', () => {
  it("posts the event to the insight's own track endpoint, not the analytics one", async () => {
    // ARGUMENTS asserted, not just the call count. The codebase already has a
    // `trackInsightViewed` that posts to /api/analytics/track — a different
    // endpoint writing a different table. A call-count-only assertion would go
    // green against the wrong one.
    const outcome = await trackInsightEngagement('abc-123', 'metadata_expand');

    expect(outcome).toBe('tracked');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('/api/insights/abc-123/track');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      event: 'metadata_expand',
    });
  });

  it('does not re-send for the same card in the same session', async () => {
    // A view is a view, not a repaint. React re-renders, filter changes and
    // scrolling back up a list would each otherwise re-fire.
    const first = await trackInsightEngagement('abc-123', 'view');
    const second = await trackInsightEngagement('abc-123', 'view');

    expect(first).toBe('tracked');
    expect(second).toBe('duplicate');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('tracks view and metadata_expand independently for the same card', async () => {
    // The two answer different questions and must not dedupe against each other:
    // "dismissed AND never expanded" is the quality signal, and it needs the
    // expand to be recordable on a card already counted as viewed.
    await trackInsightEngagement('abc-123', 'view');
    await trackInsightEngagement('abc-123', 'metadata_expand');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const events = mockFetch.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).event
    );
    expect(events).toEqual(['view', 'metadata_expand']);
  });

  it("reports 'failed' when the server rejects the write", async () => {
    // THE LESSON THIS FILE IS PAYING FOR. `dispatchCategorizedPush` returns
    // 'sent' after a send routine that iterates zero subscriptions, so
    // notification_deliveries records notifications nobody received. An outcome
    // that cannot be false is not telemetry. Before the grant migration this
    // endpoint returned 42501 for every call, and 'tracked' would have lied
    // about it in exactly the same way.
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(trackInsightEngagement('abc-123', 'view')).resolves.toBe('failed');
  });

  it('never throws when the network does', async () => {
    // Telemetry must not become an error message about somebody's spending.
    mockFetch.mockRejectedValue(new Error('offline'));

    await expect(trackInsightEngagement('abc-123', 'view')).resolves.toBe('failed');
  });

  it('a failed call can be retried; a successful one cannot', async () => {
    // A 401 during a token refresh must not permanently silence this card for
    // the session — but a success must not be re-sent either.
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await trackInsightEngagement('abc-123', 'view')).toBe('failed');

    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await trackInsightEngagement('abc-123', 'view')).toBe('tracked');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    expect(await trackInsightEngagement('abc-123', 'view')).toBe('duplicate');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
