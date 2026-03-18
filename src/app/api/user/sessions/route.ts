/**
 * User Sessions API
 * Story 9-6: Complete Device Session Management
 *
 * GET /api/user/sessions - Fetch all active sessions for user
 *
 * AC-9.6.2: Settings page displays active device sessions
 * AC-9.6.1: Auto-registers current session on first fetch
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import type { DeviceSession } from '@/types/session.types';
import { logger } from '@/lib/utils/logger';

/**
 * Hash a session token with SHA-256 to avoid storing raw JWTs in the database
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Detect device type from user agent string
 */
function detectDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const lower = ua.toLowerCase();
  if (lower.includes('ipad') || (lower.includes('android') && !lower.includes('mobile'))) {
    return 'tablet';
  }
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('ipod')) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Detect browser name from user agent string
 */
function detectBrowser(ua: string): string {
  const lower = ua.toLowerCase();
  if (lower.includes('edge') || lower.includes('edg/')) return 'Edge';
  if (lower.includes('chrome') && !lower.includes('chromium')) return 'Chrome';
  if (lower.includes('firefox')) return 'Firefox';
  if (lower.includes('safari') && !lower.includes('chrome')) return 'Safari';
  if (lower.includes('opera') || lower.includes('opr')) return 'Opera';
  return 'Unknown';
}

/**
 * Generate a human-readable device name from user agent
 */
function generateDeviceName(ua: string): string {
  const browser = detectBrowser(ua);
  const lower = ua.toLowerCase();

  let os = '';
  if (lower.includes('iphone')) os = 'iPhone';
  else if (lower.includes('ipad')) os = 'iPad';
  else if (lower.includes('android') && lower.includes('mobile')) os = 'Android Phone';
  else if (lower.includes('android')) os = 'Android Tablet';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = 'Mac';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('linux')) os = 'Linux';

  return os ? `${browser} on ${os}` : `${browser} Browser`;
}

/**
 * GET handler - Fetch all sessions for authenticated user
 * Auto-registers the current session if not already present
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

    // Get current auth session token and hash it for secure DB storage
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const sessionToken = authSession?.access_token;
    const hashedToken = sessionToken ? hashToken(sessionToken) : null;

    // Auto-register current session if we have a token
    if (hashedToken) {
      // Check if this session already exists (hashed token match)
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('session_token', hashedToken)
        .maybeSingle();

      if (!existing) {
        // Token not found — JWT may have rotated. Collect device info first.
        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || '';
        const forwardedFor = headersList.get('x-forwarded-for');
        const ipAddress = forwardedFor?.split(',')[0]?.trim() || null;
        const deviceName = generateDeviceName(userAgent).slice(0, 100);
        const deviceType = detectDeviceType(userAgent);
        const browser = detectBrowser(userAgent);

        // Look for an existing session from the same device/browser combination.
        // This handles the case where the JWT access token rotated (hourly refresh)
        // but the user is still on the same device — we update rather than insert.
        const { data: existingByDevice } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('device_name', deviceName)
          .eq('browser', browser)
          .eq('device_type', deviceType)
          .maybeSingle();

        if (existingByDevice) {
          // Same device, token rotated — update the existing session record
          await supabase
            .from('user_sessions')
            .update({ session_token: hashedToken, last_active: new Date().toISOString() })
            .eq('id', existingByDevice.id);
        } else {
          // Genuinely new device/browser — insert new session
          await supabase.from('user_sessions').insert({
            user_id: user.id,
            session_token: hashedToken,
            device_name: deviceName,
            device_type: deviceType,
            browser: browser,
            ip_address: ipAddress,
            last_active: new Date().toISOString(),
          });
        }
      } else {
        // Update last_active for the current session
        await supabase
          .from('user_sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('session_token', hashedToken);
      }
    }

    // Fetch user's sessions ordered by last_active (most recent first)
    const { data: sessions, error: fetchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });

    if (fetchError) {
      logger.error('Sessions', 'Error fetching sessions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: sessions as DeviceSession[],
      current_session_token: hashedToken || null,
    });
  } catch (error) {
    logger.error('Sessions', 'Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
