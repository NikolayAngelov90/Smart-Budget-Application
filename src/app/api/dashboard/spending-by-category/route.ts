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
import {
  buildLiveRateMap,
  convertToPreferred,
  type ConvertibleRow,
} from '@/lib/services/currencyConversion';
import { resolvePreferredCurrency } from '@/lib/services/preferredCurrency';

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
  /** The window's real bounds as `yyyy-MM-dd`.
   *
   *  D2: the drill-down needs these. It used to navigate with `month`, which is
   *  only the ANCHOR month — so clicking a slice worth a year of spend opened a
   *  single month's transactions and the totals disagreed with no explanation. */
  start: string;
  end: string;
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
    const periodParam = searchParams.get('period');

    // `?month=` is validated for the same reason `?period=` has a fallback: a
    // chart that renders the default window beats one that renders an error.
    // Unvalidated, `?month=banana` became an Invalid Date, `getFullYear()` was
    // NaN, and `NaN-NaN-NaN` reached the DATE filter — Postgres rejected it and
    // the whole donut 500'd. `?period=` got that reasoning and the parameter
    // that WINS over it did not.
    const rawMonth = searchParams.get('month');
    const monthParam =
      rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : null;

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

    // Query expense transactions with category information.
    // D3: `currency` and `exchange_rate` are selected because this route summed
    // raw `amount`, so a mixed-currency user's donut added 100 USD to 100 EUR
    // and labelled the result with their preferred symbol. DW-1 fixed exactly
    // this for /budgets, /wishlist and /what-if and skipped here; widening the
    // window from a month to a year made a single foreign trip permanently
    // visible in the total and in every percentage.
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        amount,
        category_id,
        currency,
        exchange_rate,
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

    // One lookup per currency, never per row. A missing rate is an ENRICHMENT
    // failure: the helper warns and leaves that row unconverted rather than
    // 500-ing the whole donut over one unavailable rate.
    const rows = (transactions ?? []) as unknown as Array<
      ConvertibleRow & { category_id: string; categories: { id: string; name: string; color: string } | null }
    >;
    const preferredCurrency = await resolvePreferredCurrency(supabase, user.id);
    const liveRates = await buildLiveRateMap(rows, preferredCurrency, 'SpendingByCategory');

    for (const transaction of rows) {
      const categoryId = transaction.category_id;
      const category = transaction.categories;

      if (!category) continue;

      // Stored entry-time rate first, live rate as the fallback — the same
      // conversion /budgets, /wishlist and /what-if already use.
      const amount = convertToPreferred(transaction, preferredCurrency, liveRates);
      totalExpenses += amount;

      if (categoryMap.has(categoryId)) {
        const existing = categoryMap.get(categoryId)!;
        existing.amount += amount;
        existing.transaction_count += 1;
      } else {
        categoryMap.set(categoryId, {
          category_id: categoryId,
          category_name: category.name,
          category_color: category.color,
          amount,
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
      start: toLocalISODate(windowStart),
      end: toLocalISODate(windowEnd),
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
