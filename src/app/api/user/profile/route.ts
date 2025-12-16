/**
 * User Profile API Route
 * Story 8.3: Settings Page and Account Management
 *
 * GET /api/user/profile - Fetch authenticated user's profile
 * PUT /api/user/profile - Update authenticated user's profile
 *
 * AC-8.3.2: Account information section
 * AC-8.3.5: Preferences section
 * AC-8.3.6: Optimistic UI updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile, updateUserProfile } from '@/lib/services/settingsService';
import type { UpdateUserProfilePayload } from '@/types/user.types';

/**
 * GET /api/user/profile
 * Fetch authenticated user's profile
 *
 * @returns {data: UserProfile} | {error: {message: string}}
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Fetch user profile
    const profile = await getUserProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: { message: 'Profile not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error('GET /api/user/profile error:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to fetch user profile',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/profile
 * Update authenticated user's profile
 *
 * Body: UpdateUserProfilePayload {
 *   display_name?: string;
 *   profile_picture_url?: string;
 *   preferences?: Partial<UserPreferences>;
 * }
 *
 * @returns {data: UserProfile} | {error: {message: string}}
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Parse request body
    const updates: UpdateUserProfilePayload = await request.json();

    // Validate payload (basic validation)
    if (
      updates.display_name === undefined &&
      updates.profile_picture_url === undefined &&
      updates.preferences === undefined
    ) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid request',
            details: 'At least one field must be provided for update',
          },
        },
        { status: 400 }
      );
    }

    // Update profile
    const updatedProfile = await updateUserProfile(user.id, updates);

    return NextResponse.json({ data: updatedProfile });
  } catch (error) {
    console.error('PUT /api/user/profile error:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to update user profile',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
