/**
 * Insights API Endpoint
 *
 * GET /api/insights - Fetch insights with filters
 *
 * Query Parameters:
 * - limit: number (default: 20, max: 100)
 * - dismissed: boolean (filter by dismissed status)
 * - orderBy: string (e.g., "priority", "created_at")
 * - type: InsightType (filter by insight type)
 * - search: string (search in title/description)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { InsightType } from '@/types/database.types';

// Valid insight types
const VALID_INSIGHT_TYPES: InsightType[] = [
  'spending_increase',
  'budget_recommendation',
  'unusual_expense',
  'positive_reinforcement',
];

// Type guard to validate InsightType
function isValidInsightType(type: string): type is InsightType {
  return VALID_INSIGHT_TYPES.includes(type as InsightType);
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const dismissedParam = searchParams.get('dismissed');
    const orderByParam = searchParams.get('orderBy');
    const typeParam = searchParams.get('type');
    const searchQuery = searchParams.get('search');

    // Validate and parse limit (default: 20, max: 100)
    let limit = 20;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit)) {
        limit = Math.min(Math.max(1, parsedLimit), 100);
      }
    }

    // Build query
    let query = supabase
      .from('insights')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Filter by dismissed status
    if (dismissedParam !== null) {
      const isDismissed = dismissedParam === 'true';
      query = query.eq('is_dismissed', isDismissed);
    }

    // Filter by type
    if (typeParam && isValidInsightType(typeParam)) {
      query = query.eq('type', typeParam);
    }

    // Search in title and description
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    // Order by (default: priority DESC, created_at DESC)
    if (orderByParam) {
      // Parse orderBy parameter (e.g., "priority" or "created_at DESC")
      const orderParts = orderByParam.split(' ');
      const column = orderParts[0];
      const ascending = orderParts[1]?.toUpperCase() !== 'DESC';
      query = query.order(column, { ascending });

      // Add secondary sort by created_at if primary sort is not created_at
      if (column !== 'created_at') {
        query = query.order('created_at', { ascending: false });
      }
    } else {
      // Default ordering
      query = query.order('priority', { ascending: false });
      query = query.order('created_at', { ascending: false });
    }

    // Apply limit
    query = query.limit(limit);

    // Execute query
    const { data: insights, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch insights' },
        { status: 500 }
      );
    }

    // Return response
    return NextResponse.json(
      {
        insights: insights || [],
        total: count || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching insights:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
