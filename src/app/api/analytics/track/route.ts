/**
 * Analytics Event Tracking Endpoint
 * Story 9-4: Add Insight Engagement Analytics
 *
 * POST /api/analytics/track
 *
 * Stores analytics events in the analytics_events table.
 * Requires authentication. Validates event schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TrackEventPayload, TrackEventResponse, DeviceType } from '@/types/analytics.types';
import type { Json } from '@/types/database.types';

// Valid event names for validation
const VALID_EVENT_NAMES = [
  // Insight events (Story 9-4)
  'insights_page_viewed',
  'insight_viewed',
  'insight_dismissed',
  // Export events (Story 9-5 - future)
  'csv_exported',
  'pdf_exported',
  'pwa_installed',
  'offline_mode_active',
] as const;

// Valid device types
const VALID_DEVICE_TYPES: DeviceType[] = ['mobile', 'tablet', 'desktop'];

/**
 * Validate event payload
 */
function validatePayload(payload: unknown): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload' };
  }

  const data = payload as TrackEventPayload;

  // Validate event_name
  if (!data.event_name || typeof data.event_name !== 'string') {
    return { valid: false, error: 'event_name is required and must be a string' };
  }

  if (!VALID_EVENT_NAMES.includes(data.event_name as (typeof VALID_EVENT_NAMES)[number])) {
    return { valid: false, error: `Invalid event_name. Valid values: ${VALID_EVENT_NAMES.join(', ')}` };
  }

  // Validate event_properties (optional, must be object if provided)
  if (data.event_properties !== undefined && typeof data.event_properties !== 'object') {
    return { valid: false, error: 'event_properties must be an object' };
  }

  // Validate device_type (optional, must be valid value if provided)
  if (data.device_type !== undefined && !VALID_DEVICE_TYPES.includes(data.device_type)) {
    return { valid: false, error: `Invalid device_type. Valid values: ${VALID_DEVICE_TYPES.join(', ')}` };
  }

  // Validate session_id format (optional, must be string if provided)
  if (data.session_id !== undefined && typeof data.session_id !== 'string') {
    return { valid: false, error: 'session_id must be a string' };
  }

  return { valid: true };
}

/**
 * POST handler for tracking analytics events
 */
export async function POST(request: NextRequest): Promise<NextResponse<TrackEventResponse>> {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let payload: TrackEventPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Insert event into database
    const { data, error: insertError } = await supabase
      .from('analytics_events')
      .insert({
        user_id: user.id,
        event_name: payload.event_name,
        event_properties: (payload.event_properties || {}) as Json,
        session_id: payload.session_id || null,
        device_type: payload.device_type || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Analytics] Error inserting event:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to store event' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, event_id: data.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns error (only POST is supported)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to track analytics events.',
    },
    { status: 405 }
  );
}
