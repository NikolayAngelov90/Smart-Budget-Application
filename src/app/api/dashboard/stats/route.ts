/**
 * Dashboard Stats API Route
 * Story 5.2: Financial Summary Cards
 * Story 16.6: period selector (week / month / quarter / year)
 *
 * GET /api/dashboard/stats?period=week|month|quarter|year
 * GET /api/dashboard/stats?month=YYYY-MM   (still supported)
 * Returns aggregated financial stats for dashboard (balance, income, expenses, trends)
 */

import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { calculateTrend } from '@/lib/utils/currency';
import { logger } from '@/lib/utils/logger';
import {
  buildLiveRateMap,
  convertToPreferred,
} from '@/lib/services/currencyConversion';
import { resolveClientToday } from '@/lib/utils/date';
import {
  isDashboardPeriod,
  resolvePeriodRanges,
  type DashboardPeriod,
} from '@/lib/utils/dashboardPeriod';

// Force dynamic rendering and disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface DashboardStatsResponse {
  balance: number;
  income: {
    current: number;
    previous: number;
    trend: number;
  };
  expenses: {
    current: number;
    previous: number;
    trend: number;
  };
  month: string; // YYYY-MM format
  /** Story 16.6: which window `current` covers. */
  period: DashboardPeriod;
  /** Inclusive yyyy-MM-dd bounds of `current`, for display and debugging. */
  periodStart: string;
  periodEnd: string;
}

interface AggregateResult {
  income: number;
  expenses: number;
}

interface TransactionRow {
  amount: number;
  type: 'income' | 'expense';
  currency?: string | null;
  exchange_rate?: number | null;
}

/**
 * GET handler for dashboard stats
 * Aggregates income/expense data for the selected period and the preceding one
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const periodParam = searchParams.get('period');
    // Unknown values fall back to 'month' rather than 400ing: the period is a
    // display preference, and a stale bookmark should still render a dashboard.
    const period: DashboardPeriod = isDashboardPeriod(periodParam) ? periodParam : 'month';
    // Preferred currency for cross-currency conversion (default EUR)
    const preferredCurrency = (searchParams.get('currency') || 'EUR').toUpperCase();

    // Calculate the date ranges.
    // transactions.date is a DATE column, so compare against plain YYYY-MM-DD strings —
    // toISOString() shifts local midnight into the previous UTC day on non-UTC servers.
    //
    // `month=YYYY-MM` pins the window to that calendar month and always uses
    // month-over-month, exactly as before this story; `period` is ignored then.
    //
    // `comparePartial` truncates the previous window to the same elapsed days,
    // so a part-finished current window is not compared against a complete one.
    // Only period-driven requests opt in: the no-param and `month=` paths are
    // pre-16.6 callers and keep their original whole-window comparison.
    const currentDate = monthParam
      ? new Date(`${monthParam}-01T00:00:00`)
      : resolveClientToday(searchParams.get('today'));
    const ranges = resolvePeriodRanges(monthParam ? 'month' : period, currentDate, {
      comparePartial: !monthParam && periodParam !== null,
    });
    const { start: currentMonthStart, end: currentMonthEnd } = ranges.current;
    const { start: previousMonthStart, end: previousMonthEnd } = ranges.previous;

    // Query current month aggregation
    const { data: currentData, error: currentError } = await supabase
      .from('transactions')
      .select('amount, type, currency, exchange_rate')
      .eq('user_id', user.id)
      .gte('date', format(currentMonthStart, 'yyyy-MM-dd'))
      .lte('date', format(currentMonthEnd, 'yyyy-MM-dd'));

    if (currentError) {
      logger.error('Dashboard', 'Error fetching current month stats:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch current month stats' },
        { status: 500 }
      );
    }

    // Query previous month aggregation
    const { data: previousData, error: previousError } = await supabase
      .from('transactions')
      .select('amount, type, currency, exchange_rate')
      .eq('user_id', user.id)
      .gte('date', format(previousMonthStart, 'yyyy-MM-dd'))
      .lte('date', format(previousMonthEnd, 'yyyy-MM-dd'));

    if (previousError) {
      logger.error('Dashboard', 'Error fetching previous month stats:', previousError);
      return NextResponse.json(
        { error: 'Failed to fetch previous month stats' },
        { status: 500 }
      );
    }

    // DW-1: this route's conversion is now the SHARED implementation, used by
    // budgets, wishlist and what-if too. Four copies is how those three drifted
    // from this one and started reporting different totals for the same month.
    const liveRateMap = await buildLiveRateMap(
      [...(currentData || []), ...(previousData || [])],
      preferredCurrency,
      'Dashboard'
    );

    // Aggregate current month data (convert to preferred currency using stored or live exchange rates)
    const currentAggregates = aggregateTransactions(currentData || [], preferredCurrency, liveRateMap);
    const previousAggregates = aggregateTransactions(previousData || [], preferredCurrency, liveRateMap);

    // Calculate trends
    const incomeTrend = calculateTrend(
      currentAggregates.income,
      previousAggregates.income
    );
    const expensesTrend = calculateTrend(
      currentAggregates.expenses,
      previousAggregates.expenses
    );

    // Calculate balance (income - expenses)
    const balance = currentAggregates.income - currentAggregates.expenses;

    // Format response
    const response: DashboardStatsResponse = {
      balance,
      income: {
        current: currentAggregates.income,
        previous: previousAggregates.income,
        trend: incomeTrend,
      },
      expenses: {
        current: currentAggregates.expenses,
        previous: previousAggregates.expenses,
        trend: expensesTrend,
      },
      // The month the window STARTS in — with a period, `currentDate` (today)
      // no longer describes the data. Unchanged for the month/no-param paths.
      month: format(currentMonthStart, 'yyyy-MM'),
      period: monthParam ? 'month' : period,
      periodStart: format(currentMonthStart, 'yyyy-MM-dd'),
      periodEnd: format(currentMonthEnd, 'yyyy-MM-dd'),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Dashboard', 'Unexpected error in dashboard stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Aggregates transaction data by type, converting to preferred currency when needed.
 * Uses the stored exchange_rate (amount * rate = amount in preferred currency).
 * @param transactions - Array of transactions with amount, type, currency, exchange_rate
 * @param preferredCurrency - User's display currency code (e.g. 'EUR')
 * @returns Aggregated income and expenses in preferred currency
 */
function aggregateTransactions(
  transactions: TransactionRow[],
  preferredCurrency: string,
  liveRates: Record<string, number> = {}
): AggregateResult {
  return transactions.reduce(
    (acc, transaction) => {
      const amount = convertToPreferred(transaction, preferredCurrency, liveRates);
      if (transaction.type === 'income') {
        acc.income += amount;
      } else if (transaction.type === 'expense') {
        acc.expenses += amount;
      }
      return acc;
    },
    { income: 0, expenses: 0 }
  );
}
