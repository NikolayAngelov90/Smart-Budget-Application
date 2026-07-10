/**
 * Transactions API Route
 * Story 3.1: Quick Transaction Entry Modal
 * Story 3.2: Transaction List View with Filtering and Search
 *
 * Provides GET and POST endpoints for transactions
 *
 * GET /api/transactions
 * - Fetches transactions for authenticated user with filtering
 * - Query parameters: startDate, endDate, category, type, search, limit, offset, all
 * - all=true: Bypasses pagination to export all transactions (Story 8.1)
 * - Returns transactions with category details
 *
 * POST /api/transactions
 * - Creates a new transaction for authenticated user
 * - Validates required fields (amount, type, category_id, date)
 * - Returns created transaction with category details
 *
 * Request body (POST):
 * {
 *   amount: number (positive, max 2 decimals),
 *   type: 'income' | 'expense',
 *   category_id: string (UUID),
 *   date: string (ISO date),
 *   notes?: string (optional, max 100 chars)
 * }
 *
 * Response format (GET):
 * {
 *   data: Transaction[] & { category: Category }[],
 *   count: number,
 *   limit: number,
 *   offset: number
 * }
 *
 * Response format (POST):
 * {
 *   data: Transaction & { category: Category }
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkAndTriggerForTransactionCount } from '@/lib/services/insightService';
import { evaluateNudge } from '@/lib/ai/nudgeEngine';
import { sendPushToUser, isWithinQuietHours } from '@/lib/services/pushService';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/utils/sanitize';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/utils/constants';
import { logger } from '@/lib/utils/logger';

// Type definitions
interface CreateTransactionRequest {
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  date: string;
  notes?: string;
  currency?: string; // Story 10-6: ISO 4217 currency code
  exchange_rate?: number | null; // Story 10-6: rate at time of entry
  allowance_id?: string | null; // Story 13.6: tag as private allowance spending
  /** Story 15.1: the CLIENT's local calendar day of the logging action, so the
   *  streak counts the user's day, not the server's UTC day. Validated and
   *  clamped to ±1 day of the server day; falls back to the server day. */
  log_day?: string;
}

/**
 * GET /api/transactions
 * Fetches transactions with filtering and search
 *
 * Query params:
 * - startDate: string (ISO date, optional) - Filter transactions from this date
 * - endDate: string (ISO date, optional) - Filter transactions until this date
 * - category: string (UUID, optional) - Filter by category ID
 * - type: 'income' | 'expense' (optional) - Filter by transaction type
 * - search: string (optional) - Search in notes, category name, or amount
 * - all: string ('true', optional) - If 'true', returns all transactions without pagination (Story 8.1)
 * - limit: number (optional, default: 100) - Number of transactions to return (ignored if all=true)
 * - offset: number (optional, default: 0) - Number of transactions to skip (ignored if all=true)
 *
 * Returns:
 * - 200: Success with transactions array
 * - 401: Unauthorized (no session)
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoryId = searchParams.get('category');
    const typeFilter = searchParams.get('type') as 'income' | 'expense' | null;
    const currencyFilter = searchParams.get('currency'); // Story 10-6: currency filter
    const searchQuery = searchParams.get('search');
    const all = searchParams.get('all') === 'true'; // Story 8.1: Export all transactions
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build Supabase query with server-side filtering
    let query = supabase
      .from('transactions')
      .select(
        `
        id,
        amount,
        type,
        date,
        notes,
        currency,
        exchange_rate,
        allowance_id,
        created_at,
        updated_at,
        category:categories(id, name, color, type)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id);

    // Apply date range filters
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Apply category filter
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    // Apply type filter
    if (typeFilter && ['income', 'expense'].includes(typeFilter)) {
      query = query.eq('type', typeFilter);
    }

    // Story 10-6: Apply currency filter (AC-10.6.7)
    if (currencyFilter && /^[A-Z]{3}$/.test(currencyFilter)) {
      query = query.eq('currency', currencyFilter);
    }

    // Apply search filter (notes or amount)
    // Note: For category name search, we'll filter client-side after fetching
    // because Supabase doesn't support searching in joined table columns directly
    if (searchQuery) {
      const sanitized = sanitizeSearchQuery(searchQuery);
      if (sanitized) {
        // Search in notes field (case-insensitive) and by exact amount
        const numericAmount = parseFloat(searchQuery);
        const amountFilter = !isNaN(numericAmount) ? `,amount.eq.${numericAmount}` : '';
        query = query.or(`notes.ilike.%${sanitized}%${amountFilter}`);
      }
    }

    // Order by date descending (newest first), then by created_at for consistent ordering
    query = query.order('date', { ascending: false }).order('created_at', { ascending: false });

    // Apply pagination (Story 8.1: Skip pagination when all=true for CSV export)
    if (!all) {
      query = query.range(offset, offset + limit - 1);
    }

    // Execute query
    const { data: transactions, error: fetchError, count } = await query;

    if (fetchError) {
      logger.error('Transactions', 'Error fetching transactions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // If search query exists and includes text (not just numbers),
    // filter by category name as well (client-side)
    let filteredTransactions = transactions || [];
    if (searchQuery && isNaN(parseFloat(searchQuery))) {
      filteredTransactions = filteredTransactions.filter((transaction) => {
        const category = transaction.category as { name?: string } | null;
        const categoryName = category?.name?.toLowerCase() || '';
        const notes = transaction.notes?.toLowerCase() || '';
        const search = searchQuery.toLowerCase();

        return categoryName.includes(search) || notes.includes(search);
      });
    }

    return NextResponse.json({
      data: filteredTransactions,
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Transactions', 'Unexpected error in GET /api/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Creates a new transaction
 *
 * Request body: CreateTransactionRequest
 *
 * Returns:
 * - 201: Success with created transaction
 * - 400: Bad request (validation error)
 * - 401: Unauthorized (no session)
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: CreateTransactionRequest = await request.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (!body.type || !['income', 'expense'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Type must be either "income" or "expense"' },
        { status: 400 }
      );
    }

    if (!body.category_id) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Validate date is not in the future
    const transactionDate = new Date(body.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (transactionDate > today) {
      return NextResponse.json(
        { error: 'Date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate notes length if provided
    if (body.notes && body.notes.length > 100) {
      return NextResponse.json(
        { error: 'Notes must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Verify category is usable by the caller. RLS scopes to own personal categories
    // OR shared categories in the caller's household (Story 13.5), so no user_id filter.
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, color, type, household_id')
      .eq('id', body.category_id)
      .single();

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Invalid category or category does not exist' },
        { status: 400 }
      );
    }

    // Validate category type matches transaction type
    if (category.type !== body.type) {
      return NextResponse.json(
        {
          error: `Category "${category.name}" is for ${category.type} transactions, but you're creating a ${body.type} transaction`,
        },
        { status: 400 }
      );
    }

    // Story 10-6: Validate currency if provided
    const currency = body.currency && (SUPPORTED_CURRENCIES as readonly string[]).includes(body.currency)
      ? body.currency
      : DEFAULT_CURRENCY;

    // Story 13.6: a transaction can be tagged to the caller's personal allowance (private).
    // Such a transaction must NOT be in a shared category, and is forced personal
    // (household_id NULL) so it stays owner-only and out of shared totals.
    let allowanceId: string | null = null;
    if (body.allowance_id) {
      // An allowance tracks personal *spending* — only expenses can be tagged.
      if (body.type !== 'expense') {
        return NextResponse.json(
          { error: 'Only expenses can be tagged to a personal allowance' },
          { status: 400 }
        );
      }
      if (category.household_id) {
        return NextResponse.json(
          { error: 'Allowance spending cannot be tagged to a shared category' },
          { status: 400 }
        );
      }
      // Verify the allowance belongs to the caller (owner-only RLS scopes this).
      const { data: allowance } = await supabase
        .from('personal_allowances')
        .select('id')
        .eq('id', body.allowance_id)
        .maybeSingle();
      if (!allowance) {
        return NextResponse.json(
          { error: 'Invalid allowance' },
          { status: 400 }
        );
      }
      allowanceId = allowance.id;
    }

    // Create transaction
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        amount: body.amount,
        type: body.type,
        category_id: body.category_id,
        date: body.date,
        notes: body.notes || null,
        currency,
        exchange_rate: body.exchange_rate ?? null,
        // Story 13.5: shared-category transactions inherit household_id (server-derived,
        // never from the client) so household members can see them; null for personal.
        // Story 13.6: allowance spending is always personal (household_id NULL) so it
        // remains owner-only and excluded from shared totals.
        household_id: allowanceId ? null : (category.household_id ?? null),
        allowance_id: allowanceId,
      })
      .select(
        `
        id,
        amount,
        type,
        date,
        notes,
        currency,
        exchange_rate,
        allowance_id,
        created_at,
        updated_at,
        category:categories(id, name, color, type)
      `
      )
      .single();

    if (insertError) {
      logger.error('Transactions', 'Error creating transaction:', insertError);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Async trigger: Check if 10+ transactions added and generate insights if needed
    // Story 6.5: AC1 - Automatic Generation after 10+ transactions
    // This is non-blocking - we don't wait for it to complete
    checkAndTriggerForTransactionCount(user.id).catch((error) => {
      logger.error('Transactions', 'Failed to check insight trigger:', error);
    });

    // Story 15.1: Record logging activity for the streak — ALL transaction types
    // (income counts as logging), non-fatal enrichment per the degradation policy
    // (docs/api-conventions.md#degradation-policy). The streak counts the USER's
    // calendar day: trust the client's log_day when it's a valid date within
    // ±1 day of the server day (clock-skew/timezone window, anti-farming clamp);
    // otherwise fall back to the server day. Started BEFORE the nudge await so
    // both enrichments run concurrently (no extra serial round-trips).
    const streakPromise = recordLogActivity(
      user.id,
      resolveLogDay(body.log_day, new Date())
    ).catch((err) => {
      logger.warn('Transactions', 'Streak recording failed (non-fatal):', err);
      return null;
    });

    // Story 12.3: Evaluate nudge for expense transactions only
    let nudgePayload = null;
    if (body.type === 'expense') {
      nudgePayload = await evaluateNudgeForTransaction(
        supabase,
        user.id,
        body.category_id,
        category.name
      ).catch((err) => {
        logger.warn('Transactions', 'Nudge evaluation failed (non-fatal):', err);
        return null;
      });

      // Async push dispatch if nudge fired — non-blocking
      if (nudgePayload) {
        dispatchNudgePush(user.id, nudgePayload, supabase).catch((err) => {
          logger.error('Transactions', 'Push dispatch failed (non-fatal):', err);
        });
      }
    }

    const streakResult = await streakPromise;

    return NextResponse.json(
      { data: transaction, nudge: nudgePayload, streak: streakResult?.state ?? null },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Transactions', 'Unexpected error in POST /api/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// NUDGE HELPERS — Story 12.3
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NudgePayload } from '@/types/database.types';
import { fixedWindowMonthlyAverage, AVERAGE_WINDOW_MONTHS } from '@/lib/ai/spendingAnalysis';
import { resolveBudget } from '@/lib/ai/budgetResolver';
import { localDayKey, isValidDayKey } from '@/lib/ai/streakEngine';
import { recordLogActivity } from '@/lib/services/streakService';

/**
 * Story 15.1: pick the streak log day. The client's local calendar day wins
 * when it's a real date within ±1 day of the server day (timezone/clock-skew
 * window; the clamp prevents backdated streak farming); else the server day.
 */
function resolveLogDay(clientDay: string | undefined, now: Date): string {
  const serverDay = localDayKey(now);
  if (!clientDay || !isValidDayKey(clientDay)) return serverDay;
  const toUtcMs = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  const dayDiff = Math.abs(toUtcMs(clientDay) - toUtcMs(serverDay)) / 86_400_000;
  return dayDiff <= 1 ? clientDay : serverDay;
}

/**
 * Computes the nudge context for a single category after a new expense.
 * Fetches current-month total + 3-month historical average + any explicit
 * budget from the DB, then resolves the baseline via budgetResolver (ADR-025).
 */
async function evaluateNudgeForTransaction(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  categoryName: string
): Promise<NudgePayload | null> {
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const d3m = new Date(now.getFullYear(), now.getMonth() - AVERAGE_WINDOW_MONTHS, 1);
  const threeMonthsAgo = `${d3m.getFullYear()}-${String(d3m.getMonth() + 1).padStart(2, '0')}-01`;

  // Resolve the user's display currency so nudge messages format amounts correctly.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle();
  const prefs = (profile?.preferences ?? {}) as { currency_format?: unknown };
  const currency = typeof prefs.currency_format === 'string' ? prefs.currency_format : DEFAULT_CURRENCY;

  const [currentResult, historicalResult, goalResult, budgetResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('date', currentMonthStart),

    supabase
      .from('transactions')
      .select('amount, date')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('date', threeMonthsAgo)
      .lt('date', currentMonthStart),

    supabase
      .from('goals')
      .select('name')
      .eq('user_id', userId)
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(1),

    // ADR-025: explicit personal budget for this category, if any
    supabase
      .from('category_budgets')
      .select('limit_amount')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('period', 'monthly')
      .is('household_id', null)
      .maybeSingle(),
  ]);

  if (currentResult.error || historicalResult.error) return null;

  // Current month total (the new transaction is already inserted)
  const currentMonthTotal = (currentResult.data ?? []).reduce((sum, t) => sum + t.amount, 0);

  // Historical avg: group by YYYY-MM, fixed window — see fixedWindowMonthlyAverage
  const monthMap = new Map<string, number>();
  for (const tx of historicalResult.data ?? []) {
    const key = tx.date.substring(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + tx.amount);
  }
  const historicalAvg = fixedWindowMonthlyAverage(Array.from(monthMap.values()));

  // ADR-025: baseline = explicit budget when set, else the historical average.
  // budgetResult errors are ignored (proxy fallback keeps nudges working).
  const explicitLimit = budgetResult.error ? null : (budgetResult.data?.limit_amount ?? null);
  const resolved = resolveBudget({ explicitLimit, threeMonthAverage: historicalAvg });

  const affectedGoalName = goalResult.data?.[0]?.name ?? null;

  return evaluateNudge({
    userId,
    categoryId,
    categoryName,
    currentMonthTotal,
    historicalAvg: resolved.amount,
    budgetSource: resolved.source,
    affectedGoalName,
    currency,
  });
}

/**
 * Dispatches a Web Push notification for a nudge, respecting user preferences
 * and quiet hours. Non-blocking — caller must .catch() independently.
 */
async function dispatchNudgePush(
  userId: string,
  nudge: NudgePayload,
  supabase: SupabaseClient
): Promise<void> {
  // Fetch user push preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('id', userId)
    .single();

  const prefs = (profile?.preferences ?? {}) as {
    push_nudges_enabled?: boolean;
    quiet_hours_start?: number;
    quiet_hours_end?: number;
  };

  if (!prefs.push_nudges_enabled) return;

  const quietStart = prefs.quiet_hours_start ?? 22;
  const quietEnd = prefs.quiet_hours_end ?? 8;
  if (isWithinQuietHours(quietStart, quietEnd)) return;

  const adminClient = createServiceRoleClient();
  await sendPushToUser(adminClient, userId, {
    type: 'nudge',
    title: nudge.title,
    body: nudge.body,
    data: { url: '/dashboard' },
  });
}
