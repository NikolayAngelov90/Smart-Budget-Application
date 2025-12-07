/**
 * Transactions API Route
 * Story 3.1: Quick Transaction Entry Modal
 * Story 3.2: Transaction List View with Filtering and Search
 *
 * Provides GET and POST endpoints for transactions
 *
 * GET /api/transactions
 * - Fetches transactions for authenticated user with filtering
 * - Query parameters: startDate, endDate, category, type, search, limit, offset
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

// Type definitions
interface CreateTransactionRequest {
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  date: string;
  notes?: string;
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
 * - limit: number (optional, default: 100) - Number of transactions to return
 * - offset: number (optional, default: 0) - Number of transactions to skip
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
    const searchQuery = searchParams.get('search');
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

    // Apply search filter (notes or amount)
    // Note: For category name search, we'll filter client-side after fetching
    // because Supabase doesn't support searching in joined table columns directly
    if (searchQuery) {
      // Search in notes field (case-insensitive)
      query = query.or(
        `notes.ilike.%${searchQuery}%,amount.eq.${parseFloat(searchQuery) || -1}`
      );
    }

    // Order by date descending (newest first), then by created_at for consistent ordering
    query = query.order('date', { ascending: false }).order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: transactions, error: fetchError, count } = await query;

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
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
    console.error('Unexpected error in GET /api/transactions:', error);
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

    // Verify category exists and belongs to user
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, color, type')
      .eq('id', body.category_id)
      .eq('user_id', user.id)
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
      })
      .select(
        `
        id,
        amount,
        type,
        date,
        notes,
        created_at,
        updated_at,
        category:categories(id, name, color, type)
      `
      )
      .single();

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Async trigger: Check if 10+ transactions added and generate insights if needed
    // Story 6.5: AC1 - Automatic Generation after 10+ transactions
    // This is non-blocking - we don't wait for it to complete
    checkAndTriggerForTransactionCount(user.id).catch((error) => {
      console.error('[Transaction] Failed to check insight trigger:', error);
    });

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
