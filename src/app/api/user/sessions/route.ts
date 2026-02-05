/**
 * User Sessions API
 * Story 9-6: Complete Device Session Management
 *
 * GET /api/user/sessions - Fetch all active sessions for user
 *
 * AC-9.6.2: Settings page displays active device sessions
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DeviceSession } from '@/types/session.types';

/**
 * GET handler - Fetch all sessions for authenticated user
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's sessions ordered by last_active (most recent first)
    const { data: sessions, error: fetchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });

    if (fetchError) {
      console.error('[Sessions API] Error fetching sessions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: sessions as DeviceSession[],
    });
  } catch (error) {
    console.error('[Sessions API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
