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

    const { name, color } = validation.data;

    // Check if category exists and belongs to user
    const { data: existingCategory, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, is_predefined, type')
      .eq('id', id)
      .eq('user_id', user.id)
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
    const updates: { name?: string; color?: string } = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    // Update category
    const { data: updatedCategory, error: updateError } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating category:', updateError);
      return NextResponse.json(
        { error: 'Failed to update category' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updatedCategory }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in PUT /api/categories/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/categories/:id
 * Delete custom category
 * Note: Transactions with deleted category will have category_id set to null
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

    // Check if category exists and belongs to user
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, is_predefined')
      .eq('id', id)
      .eq('user_id', user.id)
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
      console.error('Error counting transactions:', countError);
      return NextResponse.json(
        { error: 'Failed to check transaction usage' },
        { status: 500 }
      );
    }

    // If transactions exist, set their category_id to null (orphan them)
    if (transactionCount && transactionCount > 0) {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ category_id: null as unknown as string })
        .eq('category_id', id);

      if (updateError) {
        console.error('Error orphaning transactions:', updateError);
        return NextResponse.json(
          { error: 'Failed to update transactions' },
          { status: 500 }
        );
      }
    }

    // Delete category
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting category:', deleteError);
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
    console.error('Unexpected error in DELETE /api/categories/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
