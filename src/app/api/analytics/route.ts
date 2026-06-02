/**
 * Engagement Analytics API Route
 * Story 12.8: Engagement Analytics Dashboard
 *
 * GET /api/analytics?range=7|30|90 — role-gated cross-user engagement aggregates.
 *
 * Security:
 * - Authentication required (401)
 * - analytics_viewer role required, enforced server-side (403)
 * - Cross-user aggregation uses the service-role client ONLY after the role check
 * - Response is PII-free (aggregate counts + time-series only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isAnalyticsViewer, getAnalyticsDashboard } from '@/lib/services/analyticsDashboardService';
import { logger } from '@/lib/utils/logger';
import type { AnalyticsRange } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_RANGES: AnalyticsRange[] = [7, 30, 90];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Parse + validate range
    const rangeParam = parseInt(request.nextUrl.searchParams.get('range') ?? '30', 10);
    if (!VALID_RANGES.includes(rangeParam as AnalyticsRange)) {
      return NextResponse.json(
        { error: { message: 'Invalid range. Allowed: 7, 30, 90.' } },
        { status: 400 }
      );
    }

    // Server-side role enforcement
    const allowed = await isAnalyticsViewer(supabase, user.id);
    if (!allowed) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }

    // Cross-user aggregation via service-role client (gated by the check above)
    const serviceClient = createServiceRoleClient();
    const data = await getAnalyticsDashboard(serviceClient, rangeParam);

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('AnalyticsAPI', 'Error building analytics dashboard:', error);
    return NextResponse.json(
      { error: { message: 'Failed to build analytics dashboard' } },
      { status: 500 }
    );
  }
}
