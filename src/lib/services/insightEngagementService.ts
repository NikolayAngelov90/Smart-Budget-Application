/**
 * Insight engagement tracking — the client half of POST /api/insights/:id/track.
 *
 * WHY THIS EXISTS. The endpoint shipped in Epic 6 and nothing ever called it.
 * The only `/track` callers in the codebase hit `/api/analytics/track`, a
 * different endpoint writing a different table, so all five engagement columns
 * on `insights` were empty for every row ever created. A second fault hid the
 * first: `authenticated` had no UPDATE grant on those columns either, so wiring
 * the client alone would have produced the same empty table and read as "users
 * do not engage". See 20260916120000_insight_engagement_column_grants.sql.
 *
 * WHAT IT IS FOR. `metadata_expanded_count` separates a card the user opened,
 * checked and closed (the rule worked) from one swiped away unread (noise). The
 * raw dismissal rate cannot tell those apart — for `unusual_expense`, dismissal
 * is the SUCCESS path. This is the instrument the σ-masking revisit trigger in
 * spendingAnalysis.ts depends on.
 */

export type EngagementEvent = 'view' | 'metadata_expand';

/**
 * Honest outcomes. `tracked` means the server accepted the write — NOT merely
 * that the call did not throw. A dispatcher elsewhere in this codebase returns
 * 'sent' after a send routine that iterates zero subscriptions, and its delivery
 * table now records notifications nobody received. An outcome that cannot be
 * false is not telemetry.
 */
export type EngagementOutcome = 'tracked' | 'duplicate' | 'failed';

/**
 * Already recorded this session, keyed `${event}:${insightId}`.
 *
 * A view is a view, not a repaint. React re-renders, filter changes, pagination
 * and scrolling back up a list would each otherwise re-fire, and a `view_count`
 * inflated by re-renders is WORSE than zero — zero is at least honestly empty.
 * Module scope, so it survives component unmount within the session and resets
 * on reload, which is the intended granularity.
 */
const recorded = new Set<string>();

/** Test-only: the guard is module state and would leak between test cases. */
export function __resetEngagementTrackingForTest(): void {
  recorded.clear();
}

/**
 * Record one engagement event. Never throws, never blocks rendering, and never
 * surfaces to the user — this is telemetry, and a failed counter must not become
 * an error message about somebody's spending.
 */
export async function trackInsightEngagement(
  insightId: string,
  event: EngagementEvent
): Promise<EngagementOutcome> {
  const key = `${event}:${insightId}`;
  if (recorded.has(key)) return 'duplicate';
  // Claim the key BEFORE awaiting: two observers firing in the same tick would
  // otherwise both pass the check and send twice.
  recorded.add(key);

  try {
    const res = await fetch(`/api/insights/${insightId}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      // The page may be unloading when a view finally qualifies.
      keepalive: true,
    });

    if (!res.ok) {
      // Release the key so a later attempt can retry — a 401 during a token
      // refresh should not permanently silence this card for the session.
      recorded.delete(key);
      return 'failed';
    }
    return 'tracked';
  } catch {
    recorded.delete(key);
    return 'failed';
  }
}
