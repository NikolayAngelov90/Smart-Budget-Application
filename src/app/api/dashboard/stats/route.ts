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
import { getExchangeRates } from '@/lib/services/exchangeRateService';

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

interface TransactionRow {
  amount: number;
  type: 'income' | 'expense';
  currency?: string | null;
  exchange_rate?: number | null;
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    // Preferred currency for cross-currency conversion (default EUR)
    const preferredCurrency = (searchParams.get('currency') || 'EUR').toUpperCase();

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
      .select('amount, type, currency, exchange_rate')
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
      .select('amount, type, currency, exchange_rate')
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

    // Find unique currencies that need live rate lookup (no stored exchange_rate)
    const currenciesNeedingRates = new Set<string>();
    for (const tx of [...(currentData || []), ...(previousData || [])]) {
      if (tx.currency && tx.currency !== preferredCurrency && !tx.exchange_rate) {
        currenciesNeedingRates.add(tx.currency);
      }
    }

    // Fetch live rates for those currencies (cached via Redis, max 1 API call/hour)
    const liveRateMap: Record<string, number> = {};
    for (const fromCurrency of currenciesNeedingRates) {
      try {
        const rateData = await getExchangeRates(fromCurrency);
        const rate = rateData.rates[preferredCurrency];
        if (rate != null) {
          liveRateMap[fromCurrency] = rate;
        }
      } catch (e) {
        console.warn(`[DashboardStats] Could not fetch live rate for ${fromCurrency}→${preferredCurrency}:`, e);
      }
    }

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
      let amount = transaction.amount;
      // Convert to preferred currency if transaction was entered in a different currency
      if (transaction.currency && transaction.currency !== preferredCurrency) {
        if (transaction.exchange_rate) {
          // Use stored exchange rate (most accurate — rate at time of entry)
          amount = amount * transaction.exchange_rate;
        } else if (liveRates[transaction.currency] != null) {
          // Fallback to live rate (for transactions entered before currency preference was set)
          amount = amount * liveRates[transaction.currency]!;
        }
      }
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
