/**
 * Dashboard Stats API Route
 * Story 5.2: Financial Summary Cards
 *
 * GET /api/dashboard/stats?month=YYYY-MM
 * Returns aggregated financial stats for dashboard (balance, income, expenses, trends)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateTrend } from '@/lib/utils/currency';

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
}

interface AggregateResult {
  income: number;
  expenses: number;
}

/**
 * GET handler for dashboard stats
 * Aggregates income/expense data for current and previous month
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

    // Calculate current month date range
    const currentDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
    const currentMonthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const currentMonthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // Calculate previous month date range
    const previousMonthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    const previousMonthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0,
      23,
      59,
      59
    );

    // Query current month aggregation
    const { data: currentData, error: currentError } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .gte('date', currentMonthStart.toISOString())
      .lte('date', currentMonthEnd.toISOString());

    if (currentError) {
      console.error('Error fetching current month stats:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch current month stats' },
        { status: 500 }
      );
    }

    // Query previous month aggregation
    const { data: previousData, error: previousError } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .gte('date', previousMonthStart.toISOString())
      .lte('date', previousMonthEnd.toISOString());

    if (previousError) {
      console.error('Error fetching previous month stats:', previousError);
      return NextResponse.json(
        { error: 'Failed to fetch previous month stats' },
        { status: 500 }
      );
    }

    // Aggregate current month data
    const currentAggregates = aggregateTransactions(currentData || []);
    const previousAggregates = aggregateTransactions(previousData || []);

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
      month: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in dashboard stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Aggregates transaction data by type
 * @param transactions - Array of transactions with amount and type
 * @returns Aggregated income and expenses
 */
function aggregateTransactions(
  transactions: Array<{ amount: number; type: 'income' | 'expense' }>
): AggregateResult {
  return transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === 'income') {
        acc.income += transaction.amount;
      } else if (transaction.type === 'expense') {
        acc.expenses += transaction.amount;
      }
      return acc;
    },
    { income: 0, expenses: 0 }
  );
}
