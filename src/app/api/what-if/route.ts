/**
 * API Route: What-If simulation context (Story 14.4 / FR16)
 *
 * GET /api/what-if - static context for the client-side simulator:
 * per-category 3-month average monthly spend, active subscriptions normalized
 * to monthly cost, and the nearest unmet future-deadline goal.
 *
 * READ-ONLY by design — the simulator is exploratory (AC #5): this feature has
 * no POST/PATCH anywhere and never writes budgets, transactions, or
 * subscriptions. All projection math runs client-side in whatIfEngine.
 *
 * Degradation: subscriptions/goal fail independently to empty/null (warn logs);
 * missing expense history → hasData:false empty state — never fabricated zeros.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { calculateMean } from '@/lib/ai/spendingAnalysis';
import { toLocalISODate } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import type { WhatIfContextResponse, WhatIfSubscription } from '@/types/database.types';

export const dynamic = 'force-dynamic';

interface GoalRow {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
}

/** Recurring charge → monthly amount (frequency enums from migration 012) */
function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return Math.round(amount * (52 / 12) * 100) / 100;
    case 'quarterly':
      return Math.round((amount / 3) * 100) / 100;
    case 'annual':
      return Math.round((amount / 12) * 100) / 100;
    default: // monthly
      return Math.round(amount * 100) / 100;
  }
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

    const today = new Date();
    const todayKey = toLocalISODate(today);
    const currentMonthStart = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const threeMonthsAgo = toLocalISODate(new Date(today.getFullYear(), today.getMonth() - 3, 1));

    // goals are not in the typed Database schema (goalService pattern)
    const genericClient = supabase as unknown as SupabaseClient;

    const [historyResult, categoriesResult, subscriptionsResult, goalsResult] = await Promise.all([
      // Prior 3 calendar months of expenses (excludes the partial current month)
      supabase
        .from('transactions')
        .select('category_id, amount, exchange_rate, date')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', threeMonthsAgo)
        .lt('date', currentMonthStart),
      supabase
        .from('categories')
        .select('id, name, color')
        .eq('user_id', user.id)
        .eq('type', 'expense'),
      supabase
        .from('detected_subscriptions')
        .select('id, merchant_pattern, estimated_amount, frequency')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      // 14-3 reviewed shape: future deadlines only, unmet pick client-side
      genericClient
        .from('goals')
        .select('name, target_amount, current_amount, deadline')
        .eq('user_id', user.id)
        .not('deadline', 'is', null)
        .gt('deadline', todayKey)
        .order('deadline', { ascending: true })
        .limit(10),
    ]);

    // Expense history + category names are the simulator's core inputs — without
    // either there are no honest sliders to show (never fabricate zero-averages).
    if (historyResult.error || categoriesResult.error) {
      logger.warn(
        'WhatIf',
        'expense history unavailable:',
        historyResult.error ?? categoriesResult.error
      );
      const empty: WhatIfContextResponse = {
        hasData: false,
        categories: [],
        subscriptions: [],
        goal: null,
      };
      return NextResponse.json(empty);
    }

    // 3-month average per category: bucket by category × YYYY-MM month key
    // (timezone-safe string slice), then mean over the months present —
    // same semantics as the nudge helper and forecastEngine.
    const monthMaps = new Map<string, Map<string, number>>();
    for (const tx of historyResult.data ?? []) {
      if (!tx.category_id) continue;
      const monthKey = String(tx.date).slice(0, 7);
      const amount = tx.exchange_rate ? tx.amount * tx.exchange_rate : tx.amount;
      if (!monthMaps.has(tx.category_id)) monthMaps.set(tx.category_id, new Map());
      const byMonth = monthMaps.get(tx.category_id)!;
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + amount);
    }

    const categories = (categoriesResult.data ?? [])
      .map((c) => {
        const monthlyTotals = Array.from(monthMaps.get(c.id)?.values() ?? []);
        const avg = Math.round(calculateMean(monthlyTotals) * 100) / 100;
        return { category_id: c.id, name: c.name, color: c.color, avg_monthly: avg };
      })
      .filter((c) => c.avg_monthly > 0)
      .sort((a, b) => b.avg_monthly - a.avg_monthly);

    let subscriptions: WhatIfSubscription[] = [];
    if (subscriptionsResult.error) {
      logger.warn('WhatIf', 'subscriptions unavailable:', subscriptionsResult.error);
    } else {
      subscriptions = (subscriptionsResult.data ?? []).map((s) => ({
        id: s.id,
        name: s.merchant_pattern,
        monthly_amount: toMonthlyAmount(s.estimated_amount, s.frequency),
      }));
    }

    let goal: WhatIfContextResponse['goal'] = null;
    if (goalsResult.error) {
      logger.warn('WhatIf', 'goals unavailable:', goalsResult.error);
    } else {
      const nearest =
        ((goalsResult.data ?? []) as GoalRow[]).find(
          (g) => g.target_amount > g.current_amount
        ) ?? null;
      if (nearest) {
        goal = {
          name: nearest.name,
          target_amount: nearest.target_amount,
          current_amount: nearest.current_amount,
          deadline: nearest.deadline,
        };
      }
    }

    const response: WhatIfContextResponse = {
      hasData: categories.length > 0,
      categories,
      subscriptions,
      goal,
    };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('WhatIf', 'GET failed:', error);
    return NextResponse.json(
      { error: { message: 'Failed to load simulation context' } },
      { status: 500 }
    );
  }
}
