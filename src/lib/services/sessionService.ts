/**
 * Session Service
 * Story 9-6: Complete Device Session Management
 *
 * Client-side service for managing device sessions.
 * Handles fetching, updating, and revoking sessions.
 */

import type { DeviceSession } from '@/types/session.types';

const SESSION_API_BASE = '/api/user/sessions';

/**
 * Fetch all active sessions for the current user
 * AC-9.6.2: Settings page displays active device sessions
 */
export async function getUserSessions(): Promise<DeviceSession[]> {
  const response = await fetch(SESSION_API_BASE);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sessions');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update device name for a session
 * AC-9.6.3: User can edit device name inline
 */
export async function updateDeviceName(
  sessionId: string,
  deviceName: string
): Promise<DeviceSession> {
  const response = await fetch(`${SESSION_API_BASE}/${sessionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_name: deviceName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update device name');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Revoke (delete) a session - remote logout
 * AC-9.6.5: User can click "Revoke Access" button
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const response = await fetch(`${SESSION_API_BASE}/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke session');
  }
}

/**
 * Get the current session ID from localStorage
 * Used to identify and protect the current session from revocation
 * AC-9.6.7: Current session protection
 */
export function getCurrentSessionToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  // The session token is stored by Supabase auth in localStorage
  // We'll use the analytics session ID as a proxy since it's unique per browser
  return localStorage.getItem('analytics_session_id');
}

/**
 * Detect device type from user agent
 * Used when creating new sessions
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') {
    return 'desktop';
  }

  const ua = navigator.userAgent.toLowerCase();

  // Check for tablets first (they often include 'mobile' in UA)
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }

  // Check for mobile devices
  if (
    ua.includes('mobile') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('android')
  ) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Detect browser name from user agent
 */
export function detectBrowser(): string {
  if (typeof navigator === 'undefined') {
    return 'Unknown';
  }

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('edge')) {
    return 'Edge';
  }
  if (ua.includes('chrome') && !ua.includes('chromium')) {
    return 'Chrome';
  }
  if (ua.includes('firefox')) {
    return 'Firefox';
  }
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'Safari';
  }
  if (ua.includes('opera') || ua.includes('opr')) {
    return 'Opera';
  }

  return 'Unknown';
}

/**
 * Generate default device name from browser and device type
 */
export function generateDeviceName(): string {
  const browser = detectBrowser();
  const deviceType = detectDeviceType();

  if (typeof navigator === 'undefined') {
    return `${browser} on ${deviceType}`;
  }

  const ua = navigator.userAgent.toLowerCase();

  // More specific device names
  if (ua.includes('iphone')) {
    return `${browser} on iPhone`;
  }
  if (ua.includes('ipad')) {
    return `${browser} on iPad`;
  }
  if (ua.includes('android') && ua.includes('mobile')) {
    return `${browser} on Android Phone`;
  }
  if (ua.includes('android')) {
    return `${browser} on Android Tablet`;
  }
  if (ua.includes('macintosh') || ua.includes('mac os')) {
    return `${browser} on Mac`;
  }
  if (ua.includes('windows')) {
    return `${browser} on Windows`;
  }
  if (ua.includes('linux')) {
    return `${browser} on Linux`;
  }

  return `${browser} Browser`;
}

// Export service object
export const sessionService = {
  getUserSessions,
  updateDeviceName,
  revokeSession,
  getCurrentSessionToken,
  detectDeviceType,
  detectBrowser,
  generateDeviceName,
};

export default sessionService;
