/**
 * Month-over-Month Comparison API Route
 * Story 5.5: Month-over-Month Comparison Highlights
 *
 * GET /api/dashboard/month-over-month?month=YYYY-MM
 * Returns categories with significant spending changes (>20%) between current and previous month
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// Force dynamic rendering and disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface CategoryChangeData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  currentAmount: number;              // Spending this month
  previousAmount: number;             // Spending last month
  percentChange: number;              // ((current - previous) / previous) * 100
  absoluteChange: number;             // current - previous
  direction: 'increase' | 'decrease'; // For rendering up/down arrows
}

export interface MonthOverMonthResponse {
  changes: CategoryChangeData[];      // Filtered to significant changes (>20%)
  currentMonth: string;               // YYYY-MM
  previousMonth: string;              // YYYY-MM
}

/**
 * GET handler for month-over-month comparison
 * Aggregates spending by category for current and previous month, calculates changes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get month parameter (default to current month)
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    // Validate month parameter format (YYYY-MM)
    if (monthParam && !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: 'Invalid month format. Expected YYYY-MM (e.g., 2025-11)' },
        { status: 400 }
      );
    }

    // Parse month or default to current
    const currentMonthDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
    const previousMonthDate = subMonths(currentMonthDate, 1);

    // Calculate date ranges
    const currentStart = startOfMonth(currentMonthDate);
    const currentEnd = endOfMonth(currentMonthDate);
    const previousStart = startOfMonth(previousMonthDate);
    const previousEnd = endOfMonth(previousMonthDate);

    // Format for response
    const currentMonth = format(currentMonthDate, 'yyyy-MM');
    const previousMonth = format(previousMonthDate, 'yyyy-MM');

    // Query current month transactions
    const { data: currentTransactions, error: currentError } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', currentStart.toISOString())
      .lte('date', currentEnd.toISOString());

    if (currentError) {
      console.error('Error fetching current month transactions:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch current month data' },
        { status: 500 }
      );
    }

    // Query previous month transactions
    const { data: previousTransactions, error: previousError } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', previousStart.toISOString())
      .lte('date', previousEnd.toISOString());

    if (previousError) {
      console.error('Error fetching previous month transactions:', previousError);
      return NextResponse.json(
        { error: 'Failed to fetch previous month data' },
        { status: 500 }
      );
    }

    // Aggregate by category (client-side)
    const currentMap = new Map<string, number>();
    const previousMap = new Map<string, number>();

    for (const transaction of currentTransactions || []) {
      const current = currentMap.get(transaction.category_id) || 0;
      currentMap.set(transaction.category_id, current + transaction.amount);
    }

    for (const transaction of previousTransactions || []) {
      const current = previousMap.get(transaction.category_id) || 0;
      previousMap.set(transaction.category_id, current + transaction.amount);
    }

    // Get all unique category IDs
    const categoryIds = new Set([
      ...Array.from(currentMap.keys()),
      ...Array.from(previousMap.keys()),
    ]);

    // Fetch category details
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, color')
      .in('id', Array.from(categoryIds));

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // Calculate changes and filter to significant ones (>20%)
    const changes: CategoryChangeData[] = [];

    for (const category of categories || []) {
      const currentAmount = currentMap.get(category.id) || 0;
      const previousAmount = previousMap.get(category.id) || 0;

      // Skip if both months have zero spending
      if (currentAmount === 0 && previousAmount === 0) {
        continue;
      }

      // Calculate percent change
      // Handle edge case: previous = 0, current > 0 (show as 100% increase)
      let percentChange: number;
      if (previousAmount === 0 && currentAmount > 0) {
        percentChange = 100;
      } else if (previousAmount === 0) {
        continue; // Both are 0, already handled above
      } else {
        percentChange = ((currentAmount - previousAmount) / previousAmount) * 100;
      }

      const absoluteChange = currentAmount - previousAmount;

      // Filter to significant changes only (>20% absolute)
      if (Math.abs(percentChange) > 20) {
        changes.push({
          categoryId: category.id,
          categoryName: category.name,
          categoryColor: category.color,
          currentAmount,
          previousAmount,
          percentChange,
          absoluteChange,
          direction: currentAmount > previousAmount ? 'increase' : 'decrease',
        });
      }
    }

    // Sort by absolute percent change (most significant first)
    changes.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    // Limit to top 5
    const topChanges = changes.slice(0, 5);

    // Format response
    const response: MonthOverMonthResponse = {
      changes: topChanges,
      currentMonth,
      previousMonth,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in month-over-month API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
