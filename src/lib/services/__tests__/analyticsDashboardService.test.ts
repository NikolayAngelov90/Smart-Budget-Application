/**
 * Analytics Dashboard Service Tests — Story 12.8
 */

const mockAggregate = jest.fn();
jest.mock('@/lib/analytics/aggregateAnalytics', () => ({
  aggregateAnalytics: (...args: unknown[]) => mockAggregate(...args),
}));

jest.mock('@/lib/utils/date', () => ({
  toLocalISODate: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
}));

import { isAnalyticsViewer, getAnalyticsDashboard } from '../analyticsDashboardService';

describe('isAnalyticsViewer', () => {
  function client(row: object | null, error: object | null = null) {
    return {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: row, error }),
      }),
    };
  }

  it('returns true when analytics_viewer is true', async () => {
    const result = await isAnalyticsViewer(client({ analytics_viewer: true }) as never, 'u1');
    expect(result).toBe(true);
  });

  it('returns false when analytics_viewer is false', async () => {
    const result = await isAnalyticsViewer(client({ analytics_viewer: false }) as never, 'u1');
    expect(result).toBe(false);
  });

  it('returns false when no profile row exists', async () => {
    const result = await isAnalyticsViewer(client(null) as never, 'u1');
    expect(result).toBe(false);
  });

  it('throws on DB error', async () => {
    await expect(isAnalyticsViewer(client(null, { message: 'boom' }) as never, 'u1')).rejects.toBeDefined();
  });
});

describe('getAnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAggregate.mockReturnValue({ range_days: 30, total_events: 2 });
  });

  function serviceClient(rows: object[]) {
    return {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    };
  }

  it('fetches events and delegates to aggregateAnalytics', async () => {
    const rows = [
      { user_id: 'u1', event_name: 'insight_viewed', event_properties: {}, timestamp: '2026-06-01T00:00:00Z' },
      { user_id: 'u2', event_name: 'csv_exported', event_properties: {}, timestamp: '2026-06-02T00:00:00Z' },
    ];
    const result = await getAnalyticsDashboard(serviceClient(rows) as never, 30, new Date('2026-06-15'));
    expect(mockAggregate).toHaveBeenCalledWith(rows, 30);
    expect(result.total_events).toBe(2);
  });
});
