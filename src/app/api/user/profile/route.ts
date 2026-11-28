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
import { logger } from '@/lib/utils/logger';
import { checkName, nameApiMessage, normalizeName } from '@/lib/validation/names';

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
      return NextResponse.json({ error: { message: 'Profile not found' } }, { status: 404 });
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    logger.error('Profile', 'GET /api/user/profile error:', error);
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

    // The display name follows the shared name rule (spec-cyrillic-names): any
    // script, normalised before it is stored. Empty after normalising - or null -
    // CLEARS it (stored as NULL, never as ''), as clearing the field means.
    if (updates.display_name !== undefined) {
      const raw: unknown = updates.display_name;
      if (raw !== null && typeof raw !== 'string') {
        return NextResponse.json(
          {
            error: { message: 'Invalid request', details: 'display_name must be a string or null' },
          },
          { status: 400 }
        );
      }
      if (raw === null || normalizeName(raw) === '') {
        updates.display_name = null;
      } else {
        const nameCheck = checkName(raw, 'displayName');
        if (!nameCheck.ok) {
          return NextResponse.json(
            {
              error: {
                message: 'Invalid request',
                details: nameApiMessage('Display', nameCheck.problem, nameCheck.max),
                problem: nameCheck.problem,
              },
            },
            { status: 400 }
          );
        }
        updates.display_name = nameCheck.name;
      }
    }

    // Update profile
    const updatedProfile = await updateUserProfile(user.id, updates);

    return NextResponse.json({ data: updatedProfile });
  } catch (error) {
    logger.error('Profile', 'PUT /api/user/profile error:', error);
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
