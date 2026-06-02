/**
 * Analytics Aggregator
 *
 * Pure computation that turns raw analytics_events into the engagement
 * dashboard data (Story 12.8). PII-free output — only counts and time-series,
 * never user identifiers.
 *
 * No Supabase, no side effects — pure input → output.
 */

import { startOfWeek } from 'date-fns';
import type {
  AnalyticsDashboardData,
  ExportUsage,
  InsightEngagementPoint,
  PwaInstallsByPlatform,
  WauPoint,
} from '@/types/database.types';

export interface AnalyticsEventRow {
  user_id: string;
  event_name: string;
  event_properties: Record<string, unknown> | null;
  timestamp: string;
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Aggregates analytics events into the dashboard data structure.
 */
export function aggregateAnalytics(
  events: AnalyticsEventRow[],
  rangeDays: number
): AnalyticsDashboardData {
  // --- Insight engagement: views vs dismissals per insight_type ---
  const engagementMap = new Map<string, { views: number; dismissals: number }>();
  const bump = (type: string, key: 'views' | 'dismissals') => {
    const entry = engagementMap.get(type) ?? { views: 0, dismissals: 0 };
    entry[key] += 1;
    engagementMap.set(type, entry);
  };

  // --- Export usage ---
  const exportUsage: ExportUsage = {
    csv_count: 0,
    pdf_count: 0,
    csv_total_transactions: 0,
    pdf_total_pages: 0,
  };

  // --- PWA installs by platform ---
  const pwaMap = new Map<string, number>();
  let pwaTotal = 0;

  // --- WAU: distinct users per ISO week ---
  const weekUsers = new Map<string, Set<string>>();

  for (const ev of events) {
    const props = ev.event_properties ?? {};

    switch (ev.event_name) {
      case 'insight_viewed':
        bump(asString(props.insight_type, 'unknown'), 'views');
        break;
      case 'insight_dismissed':
        bump(asString(props.insight_type, 'unknown'), 'dismissals');
        break;
      case 'csv_exported':
        exportUsage.csv_count += 1;
        exportUsage.csv_total_transactions += asNumber(props.transaction_count);
        break;
      case 'pdf_exported':
        exportUsage.pdf_count += 1;
        exportUsage.pdf_total_pages += asNumber(props.page_count);
        break;
      case 'pwa_installed': {
        const platform = asString(props.platform, 'Unknown');
        pwaMap.set(platform, (pwaMap.get(platform) ?? 0) + 1);
        pwaTotal += 1;
        break;
      }
      default:
        break;
    }

    // WAU bucketing (all events count toward activity).
    // Guard against malformed timestamps so a bad row can't create a junk bucket.
    const ts = new Date(ev.timestamp);
    if (!Number.isNaN(ts.getTime())) {
      const weekKey = toLocalISODate(startOfWeek(ts, { weekStartsOn: 1 }));
      if (!weekUsers.has(weekKey)) weekUsers.set(weekKey, new Set());
      weekUsers.get(weekKey)!.add(ev.user_id);
    }
  }

  const insight_engagement: InsightEngagementPoint[] = Array.from(engagementMap.entries())
    .map(([insight_type, v]) => ({ insight_type, views: v.views, dismissals: v.dismissals }))
    .sort((a, b) => b.views - a.views);

  const pwa_installs_by_platform: PwaInstallsByPlatform[] = Array.from(pwaMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  const wau_trend: WauPoint[] = Array.from(weekUsers.entries())
    .map(([week_start, users]) => ({ week_start, active_users: users.size }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  return {
    range_days: rangeDays,
    insight_engagement,
    export_usage: exportUsage,
    pwa_installs_by_platform,
    pwa_installs_total: pwaTotal,
    wau_trend,
    total_events: events.length,
    generated_at: new Date().toISOString(),
  };
}
