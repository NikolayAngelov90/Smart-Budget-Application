/**
 * Spending by Category API Route
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 * HP-1: `?period=` support, so the donut follows the dashboard period selector.
 *
 * GET /api/dashboard/spending-by-category?period=week|month|quarter|year
 * GET /api/dashboard/spending-by-category?month=YYYY-MM   (explicit drill-down)
 * Returns expense breakdown by category for pie/donut chart visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { toLocalISODate, resolveClientToday } from '@/lib/utils/date';
import {
  isDashboardPeriod,
  resolvePeriodRanges,
  type DashboardPeriod,
} from '@/lib/utils/dashboardPeriod';

// Force dynamic rendering and disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface SpendingByCategoryResponse {
  /** YYYY-MM of the window's anchor month. Kept for back-compat: the
   *  categories screen and the drill-down links read it. */
  month: string;
  /** The window actually aggregated. The client labels from THIS, never from
   *  its own pending selection — `keepPreviousData` holds the outgoing
   *  figures on screen while the next window loads, so labelling by selection
   *  prints "This year" over last month's money (the Story 16-6 lesson). */
  period: DashboardPeriod;
  total: number; // Total expenses for the window
  categories: Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    amount: number;
    percentage: number; // 0-100
    transaction_count: number;
  }>;
}

/**
 * GET handler for spending by category
 * Aggregates expense transactions grouped by category with percentages
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

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const periodParam = searchParams.get('period');

    // The server runs UTC; `transactions.date` holds the client's LOCAL day, so
    // a window derived from the server clock is wrong for anyone east or west of
    // UTC for part of every day. Clamped to +/-1 day server-side.
    const currentDate = monthParam
      ? new Date(`${monthParam}-01T00:00:00`)
      : resolveClientToday(searchParams.get('today'));

    // An explicit ?month= is a drill-down at a named month and always wins; it
    // has no meaningful "week" or "year" reading. Otherwise the dashboard
    // period selects the window. An UNRECOGNISED period falls back to `month`
    // rather than 400-ing: this feeds a chart, and a chart that renders the
    // default window beats one that renders an error because a stale client
    // sent a period this build no longer knows.
    const period: DashboardPeriod =
      !monthParam && isDashboardPeriod(periodParam) ? periodParam : 'month';

    const { current } = resolvePeriodRanges(period, currentDate);
    const windowStart = monthParam
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      : current.start;
    const windowEnd = monthParam
      ? new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      : current.end;

    // Query expense transactions with category information
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        amount,
        category_id,
        categories (
          id,
          name,
          color
        )
      `)
      .eq('user_id', user.id)
      .eq('type', 'expense')
      // `yyyy-MM-dd` strings, never toISOString(): `transactions.date` is a DATE
      // column, and local midnight through toISOString() lands on the PREVIOUS
      // UTC day for anyone east of UTC, bleeding a day of spend across the edge.
      .gte('date', toLocalISODate(windowStart))
      .lte('date', toLocalISODate(windowEnd));

    if (transactionsError) {
      logger.error('Dashboard', 'Error fetching transactions:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch spending data' },
        { status: 500 }
      );
    }

    // Aggregate by category
    const categoryMap = new Map<string, {
      category_id: string;
      category_name: string;
      category_color: string;
      amount: number;
      transaction_count: number;
    }>();

    let totalExpenses = 0;

    for (const transaction of transactions || []) {
      const categoryId = transaction.category_id;
      const category = transaction.categories as { id: string; name: string; color: string } | null;

      if (!category) continue;

      totalExpenses += transaction.amount;

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += transaction.amount;
        existing.transaction_count += 1;
      } else {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: category.name,
          category_color: category.color,
          amount: transaction.amount,
          transaction_count: 1,
        });
      }
    }

    // Convert to array and calculate percentages
    const categories = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      percentage: totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0,
    }));

    // Sort by amount descending (highest spending first)
    categories.sort((a, b) => b.amount - a.amount);

    // Format response
    const response: SpendingByCategoryResponse = {
      month: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      period,
      total: totalExpenses,
      categories,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Dashboard', 'Unexpected error in spending-by-category API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
