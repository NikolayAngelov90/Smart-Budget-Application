/**
 * API Route: Wishlist (Story 14.3 / FR15)
 *
 * GET  /api/wishlist - the caller's wishlist items with impact computed at read time
 * POST /api/wishlist { name, price, category_id? } - add an item
 *
 * Impact enrichments (month balance, category budget, goal delay, value alignment)
 * degrade independently to null on failure (AC #7) — an enrichment query error can
 * never 500 the list. The wishlist_items table itself (migration 033) is required;
 * without it GET fails like any other unapplied-migration endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  listWishlist,
  createItem,
  WishlistCategoryError,
} from '@/lib/services/wishlistService';
import { getValuesPlan } from '@/lib/services/valuesService';
import { computeWishlistImpact } from '@/lib/ai/wishlistImpactEngine';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import type {
  WishlistItemWithImpact,
  WishlistResponse,
  ValueWithCategories,
} from '@/types/database.types';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z
    .number()
    .positive()
    .finite()
    .max(9_999_999_999.99)
    // toFixed-based check stays exact at any magnitude (a fixed epsilon fails
    // for legitimate 2-decimal values >= ~1e8 where float error exceeds it)
    .refine((v) => Number(v.toFixed(2)) === v, {
      message: 'Price can have maximum 2 decimal places',
    }),
  category_id: z.string().uuid().nullable().optional(),
});

interface GoalRow {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
}

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

    const items = await listWishlist(user.id);
    if (items.length === 0) {
      const empty: WishlistResponse = { items: [] };
      return NextResponse.json(empty);
    }

    const today = new Date();
    const todayKey = toLocalISODate(today);
    const monthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const monthEnd = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    // goals/goal_contributions are not in the typed Database schema (goalService pattern)
    const genericClient = supabase as unknown as SupabaseClient;

    // Assemble all impact inputs in parallel; every enrichment degrades on its own.
    const [txResult, budgetsResult, goalsResult, categoriesResult, plan] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, type, exchange_rate')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lte('date', monthEnd),
      supabase
        .from('category_budgets')
        .select('category_id, limit_amount')
        .eq('user_id', user.id)
        .eq('period', 'monthly')
        .is('household_id', null),
      // Future deadlines only, server-side — otherwise expired/met goals fill the
      // window and starve out the true nearest goal (unmet filter stays client-side;
      // PostgREST can't compare two columns).
      genericClient
        .from('goals')
        .select('name, target_amount, current_amount, deadline')
        .eq('user_id', user.id)
        .not('deadline', 'is', null)
        .gt('deadline', todayKey)
        .order('deadline', { ascending: true })
        .limit(10),
      supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id),
      getValuesPlan(user.id).catch((e) => {
        logger.warn('Wishlist', 'values plan unavailable:', e);
        return [] as ValueWithCategories[];
      }),
    ]);

    // Month totals — on failure the balance becomes null downstream (an honest
    // "unknown" beats fabricating income 0 − expenses 0 − price = a red −price).
    const monthTotalsKnown = !txResult.error;
    let monthIncome = 0;
    let monthExpenses = 0;
    if (txResult.error) {
      logger.warn('Wishlist', 'month transactions unavailable:', txResult.error);
    } else {
      for (const tx of txResult.data ?? []) {
        const amount = tx.exchange_rate ? tx.amount * tx.exchange_rate : tx.amount;
        if (tx.type === 'income') monthIncome += amount;
        else if (tx.type === 'expense') monthExpenses += amount;
      }
    }

    if (budgetsResult.error) {
      logger.warn('Wishlist', 'category_budgets unavailable:', budgetsResult.error);
    }
    const budgetByCategory = new Map<string, number>(
      (budgetsResult.error ? [] : (budgetsResult.data ?? [])).map((b) => [
        b.category_id,
        b.limit_amount,
      ])
    );

    if (categoriesResult.error) {
      logger.warn('Wishlist', 'categories unavailable:', categoriesResult.error);
    }
    const categoryNames = new Map<string, string>(
      (categoriesResult.error ? [] : (categoriesResult.data ?? [])).map((c) => [c.id, c.name])
    );

    // Nearest ACTIVE goal: query returned future deadlines only; pick first unmet
    let nearestGoal: GoalRow | null = null;
    if (goalsResult.error) {
      logger.warn('Wishlist', 'goals unavailable:', goalsResult.error);
    } else {
      nearestGoal =
        ((goalsResult.data ?? []) as GoalRow[]).find(
          (g) => g.target_amount > g.current_amount
        ) ?? null;
    }

    // Per-category current-month expense spend (for budget remaining). Queried
    // separately (the month-totals query doesn't carry category_id) and only for
    // linked categories that actually have a budget — usually zero or a few ids.
    const spendByCategory = new Map<string, number>();
    // On failure, suppress the budget line entirely — "spent: 0" would render a
    // confidently wrong "leaves your full budget" instead of no line.
    let spendKnown = true;
    const budgetedLinkedCategoryIds = Array.from(
      new Set(
        items
          .map((i) => i.category_id)
          .filter((id): id is string => !!id && budgetByCategory.has(id))
      )
    );
    if (budgetedLinkedCategoryIds.length > 0) {
      const { data: spendRows, error: spendError } = await supabase
        .from('transactions')
        .select('category_id, amount, exchange_rate')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .in('category_id', budgetedLinkedCategoryIds);
      if (spendError) {
        logger.warn('Wishlist', 'category spend unavailable:', spendError);
        spendKnown = false;
      } else {
        for (const tx of spendRows ?? []) {
          const amount = tx.exchange_rate ? tx.amount * tx.exchange_rate : tx.amount;
          spendByCategory.set(tx.category_id, (spendByCategory.get(tx.category_id) ?? 0) + amount);
        }
      }
    }

    const enriched: WishlistItemWithImpact[] = items.map((item) => {
      const categoryName = item.category_id ? (categoryNames.get(item.category_id) ?? null) : null;

      // Highest-priority value mapped to the linked category (plan is priority ASC)
      const alignedValueName = item.category_id
        ? (plan.find((v) => v.category_ids.includes(item.category_id!))?.name ?? null)
        : null;

      // Hypothetical-purchase math only applies to ACTIVE items — a purchased
      // item's real transaction is (or will be) in the month totals, so keeping
      // the projection would double-count it.
      if (item.status !== 'active') {
        return {
          ...item,
          category_name: categoryName,
          impact: {
            month_balance_after: null,
            category_budget: null,
            goal_delay: null,
            aligned_value: alignedValueName,
          },
        };
      }

      const limitAmount = item.category_id ? budgetByCategory.get(item.category_id) : undefined;
      const categoryBudget =
        item.category_id && limitAmount !== undefined && categoryName && spendKnown
          ? {
              categoryName,
              limitAmount,
              spent: spendByCategory.get(item.category_id) ?? 0,
            }
          : null;

      const impact = computeWishlistImpact({
        price: item.price,
        monthIncome,
        monthExpenses,
        categoryBudget,
        nearestGoal: nearestGoal
          ? {
              name: nearestGoal.name,
              targetAmount: nearestGoal.target_amount,
              currentAmount: nearestGoal.current_amount,
              deadline: nearestGoal.deadline,
            }
          : null,
        alignedValueName,
        today,
      });

      return {
        ...item,
        category_name: categoryName,
        impact: monthTotalsKnown ? impact : { ...impact, month_balance_after: null },
      };
    });

    const response: WishlistResponse = { items: enriched };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Wishlist', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load wishlist' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'A name (1–100 chars) and a positive price (max 2 decimals) are required' } },
        { status: 400 }
      );
    }

    const item = await createItem(
      user.id,
      parsed.data.name,
      parsed.data.price,
      parsed.data.category_id ?? null
    );
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof WishlistCategoryError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    logger.error('Wishlist', 'POST failed:', error);
    return NextResponse.json({ error: { message: 'Failed to save wishlist item' } }, { status: 500 });
  }
}
