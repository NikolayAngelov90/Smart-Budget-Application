/**
 * Transaction Detail API Routes
 * Story 3.3: Edit and Delete Transactions
 *
 * Provides PUT and DELETE endpoints for individual transactions
 *
 * PUT /api/transactions/[id]
 * - Updates an existing transaction
 * - Validates user ownership via RLS
 * - Returns updated transaction with category details
 *
 * DELETE /api/transactions/[id]
 * - Deletes an existing transaction
 * - Validates user ownership via RLS
 * - Returns success response
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Type definitions
interface UpdateTransactionRequest {
  amount?: number;
  type?: 'income' | 'expense';
  category_id?: string;
  date?: string;
  notes?: string;
  currency?: string; // Story 10-6
  exchange_rate?: number | null; // Story 10-6
}

/**
 * PUT /api/transactions/[id]
 * Updates an existing transaction
 *
 * Path params:
 * - id: string (UUID) - Transaction ID to update
 *
 * Request body: UpdateTransactionRequest (partial update supported)
 *
 * Returns:
 * - 200: Success with updated transaction
 * - 400: Bad request (validation error)
 * - 401: Unauthorized (no session)
 * - 404: Not found (transaction doesn't exist or doesn't belong to user)
 * - 500: Server error
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: UpdateTransactionRequest = await request.json();

    // Validate at least one field is being updated
    if (
      !body.amount &&
      !body.type &&
      !body.category_id &&
      !body.date &&
      body.notes === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Build update object (only include fields that are provided)
    const updateData: Record<string, unknown> = {};

    if (body.amount !== undefined) {
      if (body.amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number' },
          { status: 400 }
        );
      }
      updateData.amount = body.amount;
    }

    if (body.type !== undefined) {
      if (!['income', 'expense'].includes(body.type)) {
        return NextResponse.json(
          { error: 'Type must be either "income" or "expense"' },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    if (body.category_id !== undefined) {
      // Verify category exists and belongs to user
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('id', body.category_id)
        .eq('user_id', user.id)
        .single();

      if (categoryError || !category) {
        return NextResponse.json(
          { error: 'Invalid category or category does not exist' },
          { status: 400 }
        );
      }

      // If type is being updated, verify category type matches
      const transactionType = body.type || null;
      if (transactionType && category.type !== transactionType) {
        return NextResponse.json(
          {
            error: `Category "${category.name}" is for ${category.type} transactions, but you're updating to ${transactionType}`,
          },
          { status: 400 }
        );
      }

      updateData.category_id = body.category_id;
    }

    if (body.date !== undefined) {
      // Validate date is not in the future
      const transactionDate = new Date(body.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (transactionDate > today) {
        return NextResponse.json(
          { error: 'Date cannot be in the future' },
          { status: 400 }
        );
      }

      updateData.date = body.date;
    }

    if (body.notes !== undefined) {
      if (body.notes && body.notes.length > 100) {
        return NextResponse.json(
          { error: 'Notes must be 100 characters or less' },
          { status: 400 }
        );
      }
      updateData.notes = body.notes || null;
    }

    // Story 10-6: Handle currency update (AC-10.6.8)
    if (body.currency !== undefined) {
      const validCurrencies = ['EUR', 'USD', 'GBP'];
      if (!validCurrencies.includes(body.currency)) {
        return NextResponse.json(
          { error: 'Invalid currency code' },
          { status: 400 }
        );
      }
      updateData.currency = body.currency;
    }

    if (body.exchange_rate !== undefined) {
      updateData.exchange_rate = body.exchange_rate;
    }

    // Update timestamp
    updateData.updated_at = new Date().toISOString();

    // Update transaction (RLS will enforce user_id match)
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(
        `
        id,
        amount,
        type,
        date,
        notes,
        currency,
        exchange_rate,
        created_at,
        updated_at,
        category:categories(id, name, color, type)
      `
      )
      .single();

    if (updateError || !transaction) {
      console.error('Error updating transaction:', updateError);

      // Check if transaction doesn't exist or doesn't belong to user
      const { data: checkExists } = await supabase
        .from('transactions')
        .select('id')
        .eq('id', id)
        .single();

      if (!checkExists) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: transaction }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in PUT /api/transactions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]
 * Deletes an existing transaction
 *
 * Path params:
 * - id: string (UUID) - Transaction ID to delete
 *
 * Returns:
 * - 200: Success with deleted transaction data
 * - 401: Unauthorized (no session)
 * - 404: Not found (transaction doesn't exist or doesn't belong to user)
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch transaction before deleting (for response data)
    const { data: transaction, error: fetchError } = await supabase
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
        created_at,
        updated_at,
        category:categories(id, name, color, type)
      `
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Delete transaction (RLS will enforce user_id match)
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: transaction,
        message: 'Transaction deleted successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in DELETE /api/transactions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
