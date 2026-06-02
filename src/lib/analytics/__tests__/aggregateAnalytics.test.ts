/**
 * Analytics Aggregator Tests — Story 12.8
 * Pure unit tests — no mocks.
 */

import { aggregateAnalytics, type AnalyticsEventRow } from '../aggregateAnalytics';

function ev(
  user_id: string,
  event_name: string,
  event_properties: Record<string, unknown> | null,
  timestamp: string
): AnalyticsEventRow {
  return { user_id, event_name, event_properties, timestamp };
}

describe('aggregateAnalytics', () => {
  it('returns a zeroed structure for empty events', () => {
    const result = aggregateAnalytics([], 30);
    expect(result.range_days).toBe(30);
    expect(result.insight_engagement).toEqual([]);
    expect(result.export_usage).toEqual({ csv_count: 0, pdf_count: 0, csv_total_transactions: 0, pdf_total_pages: 0 });
    expect(result.pwa_installs_total).toBe(0);
    expect(result.wau_trend).toEqual([]);
    expect(result.total_events).toBe(0);
  });

  it('groups insight views and dismissals by type', () => {
    const events = [
      ev('u1', 'insight_viewed', { insight_type: 'spending_anomaly' }, '2026-06-01T10:00:00Z'),
      ev('u1', 'insight_viewed', { insight_type: 'spending_anomaly' }, '2026-06-01T11:00:00Z'),
      ev('u2', 'insight_dismissed', { insight_type: 'spending_anomaly' }, '2026-06-02T10:00:00Z'),
      ev('u2', 'insight_viewed', { insight_type: 'budget_recommendation' }, '2026-06-02T10:00:00Z'),
    ];
    const result = aggregateAnalytics(events, 30);
    const anomaly = result.insight_engagement.find((e) => e.insight_type === 'spending_anomaly');
    expect(anomaly).toEqual({ insight_type: 'spending_anomaly', views: 2, dismissals: 1 });
    const budget = result.insight_engagement.find((e) => e.insight_type === 'budget_recommendation');
    expect(budget).toEqual({ insight_type: 'budget_recommendation', views: 1, dismissals: 0 });
    // sorted by views desc
    expect(result.insight_engagement[0]!.insight_type).toBe('spending_anomaly');
  });

  it('counts exports and sums transaction_count / page_count', () => {
    const events = [
      ev('u1', 'csv_exported', { transaction_count: 10 }, '2026-06-01T10:00:00Z'),
      ev('u1', 'csv_exported', { transaction_count: 5 }, '2026-06-02T10:00:00Z'),
      ev('u2', 'pdf_exported', { month: '2026-05', page_count: 3 }, '2026-06-03T10:00:00Z'),
    ];
    const result = aggregateAnalytics(events, 30);
    expect(result.export_usage).toEqual({
      csv_count: 2,
      pdf_count: 1,
      csv_total_transactions: 15,
      pdf_total_pages: 3,
    });
  });

  it('groups PWA installs by platform with Unknown fallback and a total', () => {
    const events = [
      ev('u1', 'pwa_installed', { platform: 'iOS' }, '2026-06-01T10:00:00Z'),
      ev('u2', 'pwa_installed', { platform: 'Android' }, '2026-06-02T10:00:00Z'),
      ev('u3', 'pwa_installed', {}, '2026-06-03T10:00:00Z'), // no platform → Unknown
    ];
    const result = aggregateAnalytics(events, 30);
    expect(result.pwa_installs_total).toBe(3);
    expect(result.pwa_installs_by_platform).toContainEqual({ platform: 'iOS', count: 1 });
    expect(result.pwa_installs_by_platform).toContainEqual({ platform: 'Unknown', count: 1 });
  });

  it('buckets distinct active users per ISO week', () => {
    const events = [
      // Week of Jun 1 2026 (Mon Jun 1)
      ev('u1', 'insights_page_viewed', {}, '2026-06-01T10:00:00Z'),
      ev('u1', 'insight_viewed', { insight_type: 'x' }, '2026-06-03T10:00:00Z'), // same user, same week
      ev('u2', 'insights_page_viewed', {}, '2026-06-04T10:00:00Z'),
      // Week of Jun 8 2026
      ev('u1', 'insights_page_viewed', {}, '2026-06-09T10:00:00Z'),
    ];
    const result = aggregateAnalytics(events, 30);
    expect(result.wau_trend).toHaveLength(2);
    const w1 = result.wau_trend.find((w) => w.week_start === '2026-06-01');
    expect(w1!.active_users).toBe(2); // u1 + u2 distinct
    const w2 = result.wau_trend.find((w) => w.week_start === '2026-06-08');
    expect(w2!.active_users).toBe(1);
  });

  it('skips events with malformed timestamps in WAU bucketing', () => {
    const events = [
      ev('u1', 'insights_page_viewed', {}, 'not-a-date'),
      ev('u2', 'insights_page_viewed', {}, '2026-06-01T10:00:00Z'),
    ];
    const result = aggregateAnalytics(events, 30);
    expect(result.wau_trend).toHaveLength(1);
    expect(result.wau_trend[0]!.week_start).toBe('2026-06-01');
    expect(result.total_events).toBe(2);
  });

  it('does not leak user ids in the output (PII-free)', () => {
    const events = [ev('secret-user', 'insight_viewed', { insight_type: 'x' }, '2026-06-01T10:00:00Z')];
    const result = aggregateAnalytics(events, 7);
    expect(JSON.stringify(result)).not.toContain('secret-user');
  });
});
