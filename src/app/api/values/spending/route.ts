/**
 * API Route: Values-context spending view
 * Story 14.2: Values-Context Spending View
 *
 * GET /api/values/spending — the caller's current-month expense grouped by their values
 * (Story 14.1 plan), with per-value share + trend vs last month + misalignment flags.
 * Owner-scoped (auth client, user_id = caller); no household data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValuesPlan } from '@/lib/services/valuesService';
import { computeValuesSpending } from '@/lib/ai/valuesSpendingEngine';
import { logger } from '@/lib/utils/logger';
import type { ValuesSpendingView } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY_VIEW: ValuesSpendingView = {
  hasPlan: false,
  totalSpend: 0,
  values: [],
  unassigned: { amount: 0, percentage: 0 },
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const values = await getValuesPlan(user.id);
    if (values.length === 0) {
      return NextResponse.json({ data: EMPTY_VIEW });
    }

    // Current + previous month windows. `transactions.date` is a DATE column ('YYYY-MM-DD'),
    // so we bucket by the YYYY-MM month KEY (timezone-independent) rather than parsing the
    // string into a Date — Date('YYYY-MM-DD') is UTC midnight and would misbucket rows on the
    // 1st of the month in non-UTC timezones. The DB query bounds just keep the result small.
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const currentKey = monthKey(now);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevKey = monthKey(prevMonthStart);

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, category_id, date')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', prevMonthStart.toISOString())
      .lt('date', nextMonthStart.toISOString());

    if (txError) {
      logger.error('ValuesSpending', 'Error fetching transactions:', txError);
      return NextResponse.json({ error: { message: 'Failed to load spending' } }, { status: 500 });
    }

    const currentByCategory: Record<string, number> = {};
    const previousByCategory: Record<string, number> = {};

    for (const tx of transactions ?? []) {
      if (!tx.category_id) continue;
      const key = String(tx.date).slice(0, 7);
      const bucket = key === currentKey ? currentByCategory : key === prevKey ? previousByCategory : null;
      if (!bucket) continue;
      bucket[tx.category_id] = (bucket[tx.category_id] ?? 0) + Number(tx.amount);
    }

    const view = computeValuesSpending({ values, currentByCategory, previousByCategory });
    return NextResponse.json({ data: view });
  } catch (error) {
    logger.error('ValuesSpending', 'Unexpected error in GET /api/values/spending:', error);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
