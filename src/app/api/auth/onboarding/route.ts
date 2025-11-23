/**
 * Onboarding API Route
 * Story 4.1: Seed Default Categories on User Signup
 *
 * POST /api/auth/onboarding
 * - Seeds default categories for newly registered users
 * - Called from signup page after successful user creation
 * - Non-blocking: Errors logged but don't prevent signup completion
 *
 * Request:
 * - No body required (user_id extracted from Supabase Auth session)
 *
 * Response 200:
 * {
 *   success: true,
 *   count: number,
 *   categories: Category[]
 * }
 *
 * Response 400: { error: 'Unauthorized' }
 * Response 500: { error: 'Failed to seed categories' }
 *
 * Integration point: src/app/(auth)/signup/page.tsx
 * Related: Epic 4 Tech Spec Workflow 1 (User Signup → Category Seeding)
 */

import { createClient } from '@/lib/supabase/server';
import { seedDefaultCategories } from '@/lib/services/seedCategoriesService';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/auth/onboarding
 * Seeds default categories for authenticated user
 *
 * Called after successful signup to initialize user's categories.
 * Implements non-blocking behavior - errors are logged but return 200 with success=false.
 *
 * @returns NextResponse with seeding result or error
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Check authentication - extract user_id from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Onboarding auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate userId is a valid UUID (Code Review Finding #2)
    const userIdSchema = z.string().uuid();
    const validation = userIdSchema.safeParse(user.id);

    if (!validation.success) {
      console.error('Invalid userId format:', user.id);
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Seed default categories for the user
    const result = await seedDefaultCategories(user.id);

    // Success response
    return NextResponse.json({
      success: result.success,
      count: result.count,
      categories: result.categories,
    });
  } catch (error) {
    // Log error with context for debugging
    console.error('Onboarding error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 500 error - caller will handle retry or proceed anyway
    return NextResponse.json(
      {
        error: 'Failed to seed categories',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
