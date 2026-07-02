/**
 * Budget Service — ADR-025
 *
 * CRUD for personal category budgets. Purely personal — every call uses the
 * AUTH-SCOPED client so the owner-only RLS (migration 032) is the security
 * boundary and is exercised in production (no service-role), like valuesService.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { CategoryBudget } from '@/types/database.types';

export class CategoryNotBudgetableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryNotBudgetableError';
  }
}

export class BudgetNotFoundError extends Error {
  constructor() {
    super('Budget not found');
    this.name = 'BudgetNotFoundError';
  }
}

/** Returns the user's personal budgets (household budgets are out of v1 scope). */
export async function listBudgets(userId: string): Promise<CategoryBudget[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('user_id', userId)
    .is('household_id', null);

  if (error) {
    logger.error('BudgetService', `list budgets failed: ${error.message}`);
    throw new Error('Failed to load budgets');
  }
  return (data ?? []) as CategoryBudget[];
}

/**
 * Creates or updates the personal monthly budget for a category.
 * The category must be RLS-visible, owned by the user, and an expense category —
 * budgets on income categories are rejected.
 */
export async function upsertBudget(
  userId: string,
  categoryId: string,
  limitAmount: number
): Promise<CategoryBudget> {
  const supabase = await createClient();

  // Validate the target category through the RLS-visible categories table.
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, user_id, type')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .maybeSingle();

  if (categoryError) {
    logger.error('BudgetService', `category lookup failed: ${categoryError.message}`);
    throw new Error('Failed to validate category');
  }
  if (!category) {
    throw new BudgetNotFoundError();
  }
  if (category.type !== 'expense') {
    throw new CategoryNotBudgetableError('Budgets can only be set on expense categories');
  }

  // Upsert against the personal slot (partial unique index WHERE household_id IS NULL).
  // Supabase upsert can't target a partial index, so do a manual select-then-write.
  const { data: existing, error: existingError } = await supabase
    .from('category_budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('period', 'monthly')
    .is('household_id', null)
    .maybeSingle();

  if (existingError) {
    logger.error('BudgetService', `budget lookup failed: ${existingError.message}`);
    throw new Error('Failed to save budget');
  }

  if (existing) {
    const { data, error } = await supabase
      .from('category_budgets')
      .update({ limit_amount: limitAmount })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error || !data) {
      logger.error('BudgetService', `budget update failed: ${error?.message}`);
      throw new Error('Failed to save budget');
    }
    return data as CategoryBudget;
  }

  const { data, error } = await supabase
    .from('category_budgets')
    .insert({
      user_id: userId,
      category_id: categoryId,
      period: 'monthly',
      limit_amount: limitAmount,
    })
    .select('*')
    .single();

  if (error || !data) {
    // 23505: a concurrent request inserted the row between our lookup and this
    // insert (select-then-insert race against the partial unique index) —
    // converge on last-write-wins by updating the winner's row.
    if (error?.code === '23505') {
      const { data: raced, error: racedError } = await supabase
        .from('category_budgets')
        .update({ limit_amount: limitAmount })
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .eq('period', 'monthly')
        .is('household_id', null)
        .select('*')
        .single();
      if (!racedError && raced) return raced as CategoryBudget;
    }
    logger.error('BudgetService', `budget insert failed: ${error?.message}`);
    throw new Error('Failed to save budget');
  }
  return data as CategoryBudget;
}

/** Deletes the user's own budget row; throws BudgetNotFoundError if not theirs. */
export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('category_budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    logger.error('BudgetService', `budget delete failed: ${error.message}`);
    throw new Error('Failed to delete budget');
  }
  if (!data || data.length === 0) {
    throw new BudgetNotFoundError();
  }
}
