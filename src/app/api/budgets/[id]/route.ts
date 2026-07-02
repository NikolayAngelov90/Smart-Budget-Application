/**
 * API Route: Single category budget (ADR-025)
 *
 * DELETE /api/budgets/:id - remove a budget (category reverts to the
 * historical-average fallback via budgetResolver)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { deleteBudget, BudgetNotFoundError } from '@/lib/services/budgetService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: { message: 'Invalid budget id' } }, { status: 400 });
    }

    await deleteBudget(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BudgetNotFoundError) {
      return NextResponse.json({ error: { message: 'Budget not found' } }, { status: 404 });
    }
    logger.error('Budgets', 'DELETE failed:', error);
    return NextResponse.json({ error: { message: 'Failed to delete budget' } }, { status: 500 });
  }
}
