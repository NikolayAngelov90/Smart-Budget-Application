/**
 * Analytics Dashboard Service Tests — Story 12.8
 *
 * MIGRATED to the shared chain mock (`@/test-utils/supabaseChain`). The
 * hand-rolled chains this replaced listed exactly the methods the service
 * happened to call, which is the shape that throws
 * `TypeError: ... is not a function` the moment production reaches for one more
 * — and a throw inside a swallowing `catch` never reaches an assertion. See
 * that file's header for the measured cost.
 *
 * CONTROL-ARM FILE: `analyticsDashboardService.ts` has no swallowing catch (it
 * rethrows both errors), so a missing chain method here would surface as a test
 * failure rather than be absorbed. Migrated anyway — the point of the migration
 * is to remove the hand-rolled SHAPE so the class cannot recur, not to fix a
 * known count of instances.
 */

const mockAggregate = jest.fn();
jest.mock('@/lib/analytics/aggregateAnalytics', () => ({
  aggregateAnalytics: (...args: unknown[]) => mockAggregate(...args),
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
}));

import { createSupabaseMock } from '@/test-utils/supabaseChain';
import { isAnalyticsViewer, getAnalyticsDashboard } from '../analyticsDashboardService';

describe('isAnalyticsViewer', () => {
  const client = (row: object | null, error: object | null = null) =>
    createSupabaseMock({ tables: { user_profiles: { data: row, error } } });

  it('returns true when analytics_viewer is true', async () => {
    const db = client({ analytics_viewer: true });
    const result = await isAnalyticsViewer(db.client, 'u1');
    expect(result).toBe(true);

    // THE FILTER, not just the result. An arg-blind stub is how a dropped user
    // scope stays green, which is this repo's documented 3x-recurring bug — and
    // the hand-rolled `eq: jest.fn().mockReturnThis()` this replaced could not
    // have caught it.
    expect(db.callsTo('user_profiles', 'eq')).toContainEqual(['id', 'u1']);
    expect(db.callsTo('user_profiles', 'select')).toContainEqual(['analytics_viewer']);
  });

  it('returns false when analytics_viewer is false', async () => {
    const result = await isAnalyticsViewer(client({ analytics_viewer: false }).client, 'u1');
    expect(result).toBe(false);
  });

  it('returns false when no profile row exists', async () => {
    const result = await isAnalyticsViewer(client(null).client, 'u1');
    expect(result).toBe(false);
  });

  it('throws on DB error', async () => {
    await expect(
      isAnalyticsViewer(client(null, { message: 'boom' }).client, 'u1')
    ).rejects.toBeDefined();
  });
});

describe('getAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAggregate.mockReturnValue({ range_days: 30, total_events: 2 });
  });

  const serviceClient = (rows: object[]) =>
    createSupabaseMock({ tables: { analytics_events: { data: rows, error: null } } });

  it('fetches events and delegates to aggregateAnalytics', async () => {
    const rows = [
      {
        user_id: 'u1',
        event_name: 'insight_viewed',
        event_properties: {},
        timestamp: '2026-06-01T00:00:00Z',
      },
      {
        user_id: 'u2',
        event_name: 'csv_exported',
        event_properties: {},
        timestamp: '2026-06-02T00:00:00Z',
      },
    ];
    const db = serviceClient(rows);
    const result = await getAnalyticsDashboard(db.client, 30, new Date('2026-06-15'));

    expect(mockAggregate).toHaveBeenCalledWith(rows, 30);
    expect(result.total_events).toBe(2);

    // The window is a DATE COLUMN comparison, which this repo has lost before
    // by stubbing the filter blind. Assert the column, and that a bound was
    // passed at all.
    const gte = db.callsTo('analytics_events', 'gte');
    expect(gte).toHaveLength(1);
    expect(gte[0]![0]).toBe('timestamp');
    expect(typeof gte[0]![1]).toBe('string');
  });
});
