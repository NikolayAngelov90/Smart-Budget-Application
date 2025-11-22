/**
 * Seed Categories Service
 * Story 4.1: Seed Default Categories on User Signup
 *
 * Service for seeding default categories on new user signup.
 * Implements idempotent seeding logic with performance target < 500ms.
 *
 * Key features:
 * - Idempotent: Check if categories exist before insert
 * - Atomic: Bulk insert all 11 categories in single transaction
 * - Performance: Target < 500ms completion
 * - Security: RLS policies enforce data isolation
 */

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CATEGORIES } from '@/lib/utils/constants';
import type { SeedResult, Category } from '@/types/category.types';

/**
 * Seeds default categories for a new user
 *
 * Creates 11 predefined categories (7 expense, 4 income) for the specified user.
 * Implements idempotent behavior - if user already has categories, returns early without error.
 *
 * @param userId - The user ID (UUID) from Supabase Auth
 * @returns Promise<SeedResult> - Success status, count, and optional category data
 * @throws Error if database operation fails (caller should handle retry logic)
 *
 * @example
 * ```typescript
 * try {
 *   const result = await seedDefaultCategories(user.id);
 *   console.log(`Seeded ${result.count} categories`);
 * } catch (error) {
 *   console.error('Seeding failed:', error);
 *   // Allow user to proceed - can add custom categories manually
 * }
 * ```
 *
 * Performance target: < 500ms for bulk insert of 11 categories
 * Idempotency: Safe to call multiple times - only seeds if count = 0
 * RLS: Uses Row Level Security policies (auth.uid() = user_id)
 */
export async function seedDefaultCategories(
  userId: string
): Promise<SeedResult> {
  try {
    const supabase = await createClient();

    // Check if user already has categories (idempotent behavior)
    const { count: existingCount, error: countError } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error checking existing categories:', countError);
      throw new Error(`Failed to check existing categories: ${countError.message}`);
    }

    // If user already has categories, return early (idempotent)
    if (existingCount && existingCount > 0) {
      console.log(`User ${userId} already has ${existingCount} categories - skipping seed`);
      return {
        success: true,
        count: 0,
        categories: [],
      };
    }

    // Prepare categories for bulk insert
    const categoriesToInsert = DEFAULT_CATEGORIES.map((category) => ({
      user_id: userId,
      name: category.name,
      color: category.color,
      type: category.type,
      is_predefined: true,
    }));

    // Bulk insert all 11 categories in single transaction
    const { data: insertedCategories, error: insertError } = await supabase
      .from('categories')
      .insert(categoriesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting default categories:', insertError);
      throw new Error(`Failed to insert categories: ${insertError.message}`);
    }

    console.log(`Successfully seeded ${insertedCategories.length} categories for user ${userId}`);

    return {
      success: true,
      count: insertedCategories.length,
      categories: insertedCategories as Category[],
    };
  } catch (error) {
    // Log error with context for debugging
    console.error('seedDefaultCategories error:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Re-throw for caller to handle (non-blocking signup)
    throw error;
  }
}
