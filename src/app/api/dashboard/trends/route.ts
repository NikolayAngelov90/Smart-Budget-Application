/**
 * Spending Trends API Route
 * Story 5.4: Spending Trends Over Time (Line Chart)
 *
 * GET /api/dashboard/trends?months=6
 * Returns monthly income/expense aggregation for line chart visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

// Force dynamic rendering and disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface MonthlyTrendData {
  month: string;                      // YYYY-MM format
  monthLabel: string;                 // "Jan", "Feb", "Mar" for chart display
  income: number;                     // Total income for this month
  expenses: number;                   // Total expenses for this month
  net: number;                        // income - expenses
}

export interface SpendingTrendsResponse {
  months: MonthlyTrendData[];         // Last N months (default 6)
  startDate: string;                  // ISO date of first month
  endDate: string;                    // ISO date of last month
}

/**
 * GET handler for spending trends
 * Aggregates income and expenses by month using SQL DATE_TRUNC
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

    // Get months parameter (default to 6)
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');
    const monthsCount = monthsParam ? parseInt(monthsParam, 10) : 6;

    // Validate months parameter
    if (isNaN(monthsCount) || monthsCount < 1 || monthsCount > 24) {
      return NextResponse.json(
        { error: 'Invalid months parameter. Must be between 1 and 24.' },
        { status: 400 }
      );
    }

    // Calculate date range (last N months)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - monthsCount + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Query transactions with server-side aggregation using SQL function
    // We need to use Supabase RPC or raw query for DATE_TRUNC
    // Since Supabase client doesn't directly support DATE_TRUNC in select,
    // we'll fetch all transactions and aggregate client-side for now
    // (In production, you'd use a database function or RPC call)

    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('date, type, amount')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: true });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch trends data' },
        { status: 500 }
      );
    }

    // Aggregate by month (client-side aggregation)
    const monthMap = new Map<string, { income: number; expenses: number }>();

    // Initialize all months in range
    const currentMonth = new Date(startDate);
    while (currentMonth <= endDate) {
      const monthKey = format(currentMonth, 'yyyy-MM');
      monthMap.set(monthKey, { income: 0, expenses: 0 });
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Aggregate transactions into months
    for (const transaction of transactions || []) {
      const transactionDate = new Date(transaction.date);
      const monthKey = format(transactionDate, 'yyyy-MM');

      const monthData = monthMap.get(monthKey);
      if (monthData) {
        if (transaction.type === 'income') {
          monthData.income += transaction.amount;
        } else if (transaction.type === 'expense') {
          monthData.expenses += transaction.amount;
        }
      }
    }

    // Convert to array and format
    const months: MonthlyTrendData[] = Array.from(monthMap.entries())
      .map(([monthKey, data]) => {
        const monthDate = new Date(`${monthKey}-01`);
        return {
          month: monthKey,
          monthLabel: format(monthDate, 'MMM'),
          income: data.income,
          expenses: data.expenses,
          net: data.income - data.expenses,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Format response
    const response: SpendingTrendsResponse = {
      months,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in trends API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
