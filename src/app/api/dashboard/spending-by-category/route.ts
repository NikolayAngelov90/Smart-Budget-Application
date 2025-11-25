/**
 * Spending by Category API Route
 * Story 5.3: Monthly Spending by Category (Pie/Donut Chart)
 *
 * GET /api/dashboard/spending-by-category?month=YYYY-MM
 * Returns expense breakdown by category for pie/donut chart visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering and disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface SpendingByCategoryResponse {
  month: string; // YYYY-MM format
  total: number; // Total expenses for the month
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

    // Get month parameter (default to current month)
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    // Calculate month date range
    const currentDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
    const monthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );

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
      .gte('date', monthStart.toISOString())
      .lte('date', monthEnd.toISOString());

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
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
      total: totalExpenses,
      categories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in spending-by-category API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
