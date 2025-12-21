/**
 * Profile Picture Upload (Phase 2)
 * API Route: POST /api/user/profile-picture
 * Updates user profile with new profile picture URL and deletes old picture
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateUserProfile } from '@/lib/services/settingsService';
import { deleteProfilePicture, isValidSupabaseStorageUrl } from '@/lib/services/uploadService';
import type { UserProfile } from '@/types/user.types';

interface UpdateProfilePictureRequest {
  profile_picture_url: string;
}

interface UpdateProfilePictureResponse {
  data?: UserProfile;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * POST /api/user/profile-picture
 * Updates user's profile picture URL and cleans up old picture
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UpdateProfilePictureResponse>> {
  try {
    // Parse request body
    const body: UpdateProfilePictureRequest = await request.json();
    const { profile_picture_url } = body;

    // Validate request
    if (!profile_picture_url) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Profile picture URL is required',
          },
        },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        },
        { status: 401 }
      );
    }

    // Validate URL is from Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Supabase URL not configured',
          },
        },
        { status: 500 }
      );
    }

    if (!isValidSupabaseStorageUrl(profile_picture_url, supabaseUrl)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_URL',
            message: 'Profile picture URL must be from Supabase Storage',
          },
        },
        { status: 400 }
      );
    }

    // Get current profile to access old picture URL
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('profile_picture_url')
      .eq('id', user.id)
      .single();

    const oldPictureUrl = currentProfile?.profile_picture_url;

    // Update profile with new picture URL
    const updatedProfile = await updateUserProfile(user.id, {
      profile_picture_url,
    });

    // Delete old picture from storage (non-blocking)
    if (oldPictureUrl && oldPictureUrl !== profile_picture_url) {
      // Fire and forget - don't await or block on deletion
      deleteProfilePicture(oldPictureUrl).catch((error) => {
        console.error('Failed to delete old profile picture:', error);
      });
    }

    return NextResponse.json(
      {
        data: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile picture update error:', error);

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update profile picture',
        },
      },
      { status: 500 }
    );
  }
}
