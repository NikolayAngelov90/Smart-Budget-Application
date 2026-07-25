/**
 * API Route: Category Operations (Update and Delete)
 * Story 4.3: Edit and Delete Custom Categories
 *
 * PUT /api/categories/:id - Update custom category (name and/or color)
 * DELETE /api/categories/:id - Delete custom category
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced
 * - Predefined categories cannot be modified or deleted
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Validation schema for update
const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim()
    .refine((val) => /^[a-zA-Z0-9\s]+$/.test(val), {
      message: 'Only letters, numbers, and spaces allowed',
    })
    .optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  // Story 13.4: per-category transparency (owner-only — enforced below)
  visibility_level: z.enum(['shared', 'category_only', 'private']).optional(),
});

/**
 * PUT /api/categories/:id
 * Update custom category (name and/or color only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Authentication check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, color, visibility_level } = validation.data;

    // Story 13.5: RLS scopes visibility (own personal OR a shared category in the
    // caller's household). No explicit user_id filter so members can manage shared ones.
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, is_predefined, type, user_id, household_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Prevent modification of predefined categories
    if (existingCategory.is_predefined) {
      return NextResponse.json(
        { error: 'Cannot modify predefined categories' },
        { status: 403 }
      );
    }

    // Story 13.4: visibility is the owner's privacy control — only the category creator
    // may change it (members can rename/recolor shared categories, but not re-share them).
    if (visibility_level !== undefined && existingCategory.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the category owner can change its visibility' },
        { status: 403 }
      );
    }

    // Check for duplicate name (if name is being updated)
    if (name && name !== existingCategory.name) {
      const { data: duplicate } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', name)
        .eq('type', existingCategory.type)
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          { error: 'Category name already exists for this type' },
          { status: 409 }
        );
      }
    }

    // Build update object (only include fields that are provided)
    const updates: { name?: string; color?: string; visibility_level?: 'shared' | 'category_only' | 'private' } = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (visibility_level !== undefined) updates.visibility_level = visibility_level;

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Categories', 'Error updating category:', updateError);
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updatedCategory }, { status: 200 });
  } catch (error) {
    logger.error('Categories', 'Unexpected error in PUT /api/categories/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/categories/:id
 * Delete a custom category.
 *
 * `transactions.category_id` is `NOT NULL` (migration 001), so a category that
 * still has transactions cannot simply be removed — its transactions must be
 * REASSIGNED to another category of the same type first. The client sends the
 * chosen target as `{ reassignTo }`; if the category is in use and no target is
 * given, we answer 409 `{ requiresReassign, transactionCount }` so the UI can
 * prompt for one. (category_budgets + value_categories cascade on delete;
 * wishlist_items are SET NULL.)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Authentication check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional reassign target (DELETE may carry a small JSON body).
    let reassignTo: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.reassignTo === 'string' && body.reassignTo) {
        reassignTo = body.reassignTo;
      }
    } catch {
      // No body — a delete for a category with no transactions.
    }

    // Story 13.5: RLS scopes visibility (own OR shared-in-household); members can delete shared.
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, is_predefined, type')
      .eq('id', id)
      .single();

    if (fetchError || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Prevent deletion of predefined categories
    if (category.is_predefined) {
      return NextResponse.json(
        { error: 'Cannot delete predefined categories' },
        { status: 403 }
      );
    }

    // Check transaction count
    const { count: transactionCount, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countError) {
      logger.error('Categories', 'Error counting transactions:', countError);
      return NextResponse.json(
        { error: 'Failed to check transaction usage' },
        { status: 500 }
      );
    }

    // In use → reassign the transactions to a same-type category before deleting.
    if (transactionCount && transactionCount > 0) {
      if (!reassignTo) {
        return NextResponse.json(
          {
            error: 'Category has transactions',
            requiresReassign: true,
            transactionCount,
          },
          { status: 409 }
        );
      }

      if (reassignTo === id) {
        return NextResponse.json(
          { error: 'Cannot reassign transactions to the category being deleted' },
          { status: 400 }
        );
      }

      // Validate the target: accessible (RLS-scoped select) and the same type,
      // so income/expense transactions never land on a mismatched category.
      const { data: target, error: targetError } = await supabase
        .from('categories')
        .select('id, type')
        .eq('id', reassignTo)
        .single();

      if (targetError || !target) {
        return NextResponse.json(
          { error: 'Target category not found' },
          { status: 400 }
        );
      }
      if (target.type !== category.type) {
        return NextResponse.json(
          { error: 'Target category must be the same type' },
          { status: 400 }
        );
      }

      const { error: reassignError } = await supabase
        .from('transactions')
        .update({ category_id: reassignTo })
        .eq('category_id', id);

      if (reassignError) {
        logger.error('Categories', 'Error reassigning transactions:', reassignError);
        return NextResponse.json(
          { error: 'Failed to reassign transactions' },
          { status: 500 }
        );
      }
    }

    // Delete category (RLS enforces own personal OR shared-in-household)
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Categories', 'Error deleting category:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete category' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Category deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Categories', 'Unexpected error in DELETE /api/categories/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
