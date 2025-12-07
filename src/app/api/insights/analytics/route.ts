/**
 * Insight Engagement Analytics Endpoint
 *
 * GET /api/insights/analytics
 *
 * Returns engagement analytics for the authenticated user's insights.
 * Provides metrics on views, dismissals, and metadata engagement.
 *
 * Epic 6 Retrospective: Insight Quality Monitoring
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface InsightAnalytics {
  totalInsights: number;
  totalViews: number;
  totalDismissed: number;
  dismissalRate: number;
  averageViewsPerInsight: number;
  averageViewsBeforeDismissal: number | null;
  metadataExpansionRate: number;
  insightsByType: {
    type: string;
    count: number;
    avgViews: number;
    dismissedCount: number;
  }[];
  recentEngagement: {
    lastViewedAt: string | null;
    lastDismissedAt: string | null;
    lastMetadataExpandedAt: string | null;
  };
}

/**
 * GET handler for analytics
 *
 * @example
 * GET /api/insights/analytics
 *
 * Response:
 * {
 *   "success": true,
 *   "analytics": { ... }
 * }
 */
export async function GET() {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all insights for analytics
    const { data: insights, error: fetchError } = await supabase
      .from('insights')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('[Analytics] Error fetching insights:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    if (!insights || insights.length === 0) {
      // Return empty analytics if no insights
      const emptyAnalytics: InsightAnalytics = {
        totalInsights: 0,
        totalViews: 0,
        totalDismissed: 0,
        dismissalRate: 0,
        averageViewsPerInsight: 0,
        averageViewsBeforeDismissal: null,
        metadataExpansionRate: 0,
        insightsByType: [],
        recentEngagement: {
          lastViewedAt: null,
          lastDismissedAt: null,
          lastMetadataExpandedAt: null,
        },
      };

      return NextResponse.json(
        {
          success: true,
          analytics: emptyAnalytics,
        },
        { status: 200 }
      );
    }

    // Calculate overall metrics
    const totalInsights = insights.length;
    const totalViews = insights.reduce((sum, i) => sum + (i.view_count || 0), 0);
    const totalDismissed = insights.filter((i) => i.is_dismissed).length;
    const dismissalRate = (totalDismissed / totalInsights) * 100;
    const averageViewsPerInsight = totalViews / totalInsights;

    // Calculate average views before dismissal (only for dismissed insights)
    const dismissedWithViews = insights.filter(
      (i) => i.is_dismissed && i.view_count && i.view_count > 0
    );
    const averageViewsBeforeDismissal =
      dismissedWithViews.length > 0
        ? dismissedWithViews.reduce((sum, i) => sum + (i.view_count || 0), 0) /
          dismissedWithViews.length
        : null;

    // Calculate metadata expansion rate
    const insightsWithExpansions = insights.filter(
      (i) => i.metadata_expanded_count && i.metadata_expanded_count > 0
    );
    const metadataExpansionRate = (insightsWithExpansions.length / totalInsights) * 100;

    // Define type for group aggregation
    interface TypeGroup {
      type: string;
      count: number;
      totalViews: number;
      dismissedCount: number;
    }

    // Group by type
    const typeGroups = insights.reduce(
      (acc, insight) => {
        const type = insight.type;
        if (!acc[type]) {
          acc[type] = {
            type,
            count: 0,
            totalViews: 0,
            dismissedCount: 0,
          };
        }
        acc[type].count += 1;
        acc[type].totalViews += insight.view_count || 0;
        if (insight.is_dismissed) {
          acc[type].dismissedCount += 1;
        }
        return acc;
      },
      {} as Record<string, TypeGroup>
    );

    const insightsByType = Object.values(typeGroups).map((group) => ({
      type: group.type,
      count: group.count,
      avgViews: group.totalViews / group.count,
      dismissedCount: group.dismissedCount,
    }));

    // Find most recent engagement timestamps
    const lastViewedAt = insights
      .filter((i) => i.last_viewed_at)
      .sort((a, b) => new Date(b.last_viewed_at!).getTime() - new Date(a.last_viewed_at!).getTime())
      [0]?.last_viewed_at || null;

    const lastDismissedAt = insights
      .filter((i) => i.dismissed_at)
      .sort((a, b) => new Date(b.dismissed_at!).getTime() - new Date(a.dismissed_at!).getTime())
      [0]?.dismissed_at || null;

    const lastMetadataExpandedAt = insights
      .filter((i) => i.last_metadata_expanded_at)
      .sort(
        (a, b) =>
          new Date(b.last_metadata_expanded_at!).getTime() -
          new Date(a.last_metadata_expanded_at!).getTime()
      )[0]?.last_metadata_expanded_at || null;

    // Build analytics response
    const analytics: InsightAnalytics = {
      totalInsights,
      totalViews,
      totalDismissed,
      dismissalRate: Math.round(dismissalRate * 100) / 100,
      averageViewsPerInsight: Math.round(averageViewsPerInsight * 100) / 100,
      averageViewsBeforeDismissal: averageViewsBeforeDismissal
        ? Math.round(averageViewsBeforeDismissal * 100) / 100
        : null,
      metadataExpansionRate: Math.round(metadataExpansionRate * 100) / 100,
      insightsByType,
      recentEngagement: {
        lastViewedAt,
        lastDismissedAt,
        lastMetadataExpandedAt,
      },
    };

    return NextResponse.json(
      {
        success: true,
        analytics,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Analytics] Error generating analytics:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate analytics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
