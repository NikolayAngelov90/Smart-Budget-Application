/**
 * Categories API Route
 * Story 3.1: Quick Transaction Entry Modal
 *
 * Provides GET endpoint for fetching user categories with recent usage tracking
 *
 * GET /api/categories
 * - Returns all categories for authenticated user
 * - Optionally filters by type (income/expense)
 * - Orders by recent usage (from transaction history)
 * - Falls back to alphabetical order for categories never used
 *
 * Response format:
 * {
 *   data: Category[],
 *   count: number
 * }
 *
 * Category schema:
 * {
 *   id: string (UUID),
 *   name: string,
 *   color: string (hex),
 *   type: 'income' | 'expense',
 *   is_predefined: boolean,
 *   last_used_at?: string (ISO timestamp from most recent transaction),
 *   usage_count?: number (total transaction count)
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * GET /api/categories
 * Fetches categories with recent usage sorting
 *
 * Query params:
 * - type: 'income' | 'expense' (optional) - filter by transaction type
 *
 * Returns:
 * - 200: Success with categories array
 * - 401: Unauthorized (no session)
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as 'income' | 'expense' | null;

    // Query to get categories with recent usage stats
    // Join with transactions to get last_used_at and usage_count
    const query = supabase
      .from('categories')
      .select(
        `
        id,
        name,
        color,
        type,
        is_predefined,
        created_at
      `
      )
      .eq('user_id', user.id);

    // Apply type filter if specified
    if (typeFilter) {
      query.eq('type', typeFilter);
    }

    const { data: categories, error: categoriesError } = await query.order(
      'name',
      { ascending: true }
    );

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // Fetch transaction usage stats for each category
    // Get most recent transaction date and count for each category
    const { data: usageStats } = await supabase
      .from('transactions')
      .select('category_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100); // Limit to recent 100 transactions for performance

    // Build usage map: category_id -> { last_used_at, usage_count }
    const usageMap = new Map<
      string,
      { last_used_at: string; usage_count: number }
    >();

    if (usageStats) {
      usageStats.forEach((transaction) => {
        const categoryId = transaction.category_id;
        if (!usageMap.has(categoryId)) {
          usageMap.set(categoryId, {
            last_used_at: transaction.created_at,
            usage_count: 1,
          });
        } else {
          const stats = usageMap.get(categoryId)!;
          stats.usage_count += 1;
        }
      });
    }

    // Merge usage stats with categories
    const categoriesWithUsage = categories.map((category) => {
      const usage = usageMap.get(category.id);
      return {
        ...category,
        last_used_at: usage?.last_used_at || null,
        usage_count: usage?.usage_count || 0,
      };
    });

    // Sort by recent usage (most recent first), then alphabetically
    categoriesWithUsage.sort((a, b) => {
      // Categories with usage come first
      if (a.last_used_at && !b.last_used_at) return -1;
      if (!a.last_used_at && b.last_used_at) return 1;

      // If both have usage, sort by most recent
      if (a.last_used_at && b.last_used_at) {
        return (
          new Date(b.last_used_at).getTime() -
          new Date(a.last_used_at).getTime()
        );
      }

      // If neither have usage, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      data: categoriesWithUsage,
      count: categoriesWithUsage.length,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
