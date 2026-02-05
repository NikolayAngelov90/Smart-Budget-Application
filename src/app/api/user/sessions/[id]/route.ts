/**
 * User Session API (Individual)
 * Story 9-6: Complete Device Session Management
 *
 * PUT /api/user/sessions/:id - Update device name
 * DELETE /api/user/sessions/:id - Revoke (delete) session
 *
 * AC-9.6.3: User can edit device name inline
 * AC-9.6.5: User can revoke device session
 * AC-9.6.7: Cannot revoke current session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DeviceSession, UpdateDeviceNamePayload } from '@/types/session.types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT handler - Update device name
 * AC-9.6.3: User can edit device name inline
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { id: sessionId } = await context.params;
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

    // Parse request body
    let payload: UpdateDeviceNamePayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate device_name
    if (!payload.device_name || typeof payload.device_name !== 'string') {
      return NextResponse.json(
        { error: 'device_name is required and must be a string' },
        { status: 400 }
      );
    }

    const deviceName = payload.device_name.trim();
    if (deviceName.length === 0 || deviceName.length > 100) {
      return NextResponse.json(
        { error: 'device_name must be between 1 and 100 characters' },
        { status: 400 }
      );
    }

    // Update the session (RLS ensures user can only update own sessions)
    const { data: session, error: updateError } = await supabase
      .from('user_sessions')
      .update({ device_name: deviceName })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Sessions API] Error updating session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update device name' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: session as DeviceSession,
    });
  } catch (error) {
    console.error('[Sessions API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - Revoke (delete) session
 * AC-9.6.5: User can revoke device session
 * AC-9.6.7: Cannot revoke current session (checked on client, but also validated here)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { id: sessionId } = await context.params;
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

    // Get current session for comparison
    const { data: { session: authSession } } = await supabase.auth.getSession();

    // First, get the session to check if it exists and belongs to user
    const { data: sessionToDelete, error: fetchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !sessionToDelete) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // AC-9.6.7: Check if trying to revoke current session
    // Compare session tokens to prevent self-lockout
    if (authSession && sessionToDelete.session_token === authSession.access_token) {
      return NextResponse.json(
        { error: 'Cannot revoke your current session' },
        { status: 400 }
      );
    }

    // Delete the session
    const { error: deleteError } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[Sessions API] Error deleting session:', deleteError);
      return NextResponse.json(
        { error: 'Failed to revoke session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('[Sessions API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
