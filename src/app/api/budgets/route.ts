/**
 * API Route: Category budgets (ADR-025)
 *
 * GET /api/budgets - the caller's personal budgets with current-month spend + status
 * PUT /api/budgets { category_id, limit_amount } - create/update a category's budget
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  listBudgets,
  upsertBudget,
  BudgetNotFoundError,
  CategoryNotBudgetableError,
} from '@/lib/services/budgetService';
import { budgetStatusFor } from '@/lib/ai/budgetResolver';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import type { BudgetsResponse, BudgetSummary } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  category_id: z.string().uuid(),
  // Strictly positive: a 0 budget would read "over" on the card while nudges and
  // forecasts (0-baseline = no signal) stay silent — surfaces must agree (ADR-025).
  // Upper bound keeps NUMERIC(12,2) overflows a 400 instead of a 500.
  limit_amount: z
    .number()
    .positive()
    .finite()
    .max(9_999_999_999.99)
    // toFixed-based check stays exact at any magnitude (a fixed epsilon fails
    // for legitimate 2-decimal values >= ~1e8 where float error exceeds it)
    .refine((v) => Number(v.toFixed(2)) === v, {
      message: 'Amount can have maximum 2 decimal places',
    }),
});

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

    const budgets = await listBudgets(user.id);

    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    if (budgets.length === 0) {
      const empty: BudgetsResponse = { budgets: [], month };
      return NextResponse.json(empty);
    }

    const monthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const monthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const categoryIds = budgets.map((b) => b.category_id);

    // One query for names/colors, one for current-month spend — no N+1.
    const [categoriesResult, spendResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, color')
        .in('id', categoryIds),
      supabase
        .from('transactions')
        .select('category_id, amount, exchange_rate')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .in('category_id', categoryIds),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (spendResult.error) throw spendResult.error;

    const categoryMap = new Map(
      (categoriesResult.data ?? []).map((c) => [c.id, { name: c.name, color: c.color }])
    );
    const spendMap = new Map<string, number>();
    for (const tx of spendResult.data ?? []) {
      // Foreign-currency transactions store the entry-time rate to the user's
      // preferred currency (same semantics as the dashboard stats route).
      const amount = tx.exchange_rate ? tx.amount * tx.exchange_rate : tx.amount;
      spendMap.set(tx.category_id, (spendMap.get(tx.category_id) ?? 0) + amount);
    }

    const summaries: BudgetSummary[] = budgets
      .filter((b) => categoryMap.has(b.category_id))
      .map((b) => {
        const category = categoryMap.get(b.category_id)!;
        const spent = Math.round((spendMap.get(b.category_id) ?? 0) * 100) / 100;
        const remaining = Math.round((b.limit_amount - spent) * 100) / 100;
        // Floor (not round) so the displayed percent never claims a threshold
        // that budgetStatusFor hasn't crossed (79.95 must not read as 80%).
        const pctUsed =
          b.limit_amount > 0
            ? Math.floor((spent / b.limit_amount) * 1000) / 10
            : spent > 0
              ? 999
              : 0;
        return {
          id: b.id,
          category_id: b.category_id,
          category_name: category.name,
          category_color: category.color,
          limit_amount: b.limit_amount,
          spent,
          remaining,
          pct_used: pctUsed,
          status: budgetStatusFor(spent, b.limit_amount),
        };
      })
      // Most urgent first: over → warning → ok, then by pct_used descending
      .sort((a, b) => {
        const rank = { over: 0, warning: 1, ok: 2 } as const;
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return b.pct_used - a.pct_used;
      });

    const response: BudgetsResponse = { budgets: summaries, month };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Budgets', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load budgets' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'A valid category_id and a positive limit_amount (max 2 decimals) are required' } },
        { status: 400 }
      );
    }

    const budget = await upsertBudget(user.id, parsed.data.category_id, parsed.data.limit_amount);
    return NextResponse.json({ data: budget });
  } catch (error) {
    if (error instanceof BudgetNotFoundError) {
      return NextResponse.json({ error: { message: 'Category not found' } }, { status: 404 });
    }
    if (error instanceof CategoryNotBudgetableError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    logger.error('Budgets', 'PUT failed:', error);
    return NextResponse.json({ error: { message: 'Failed to save budget' } }, { status: 500 });
  }
}
