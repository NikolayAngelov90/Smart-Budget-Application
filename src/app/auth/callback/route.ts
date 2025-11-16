/**
 * OAuth Callback Route Handler
 * Story 1.3: Authentication Configuration and Middleware
 * Story 2.2: Social Login (Google and GitHub)
 *
 * This route handles OAuth callback redirects from providers (Google, GitHub).
 * After user authorizes with OAuth provider, they're redirected here with a code.
 * We exchange the code for a session and redirect to the dashboard.
 *
 * Flow:
 * 1. User clicks "Continue with Google/GitHub"
 * 2. Provider redirects to this route with ?code=xxx
 * 3. We exchange code for session
 * 4. Redirect to dashboard on success, login on failure
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * GET handler for OAuth callback
 * Exchanges authorization code for user session
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  // If there's a code, exchange it for a session
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth callback error:', error.message);
      // Redirect to login with error message
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`
      );
    }

    // Success! Redirect to dashboard (root route)
    // The middleware will handle session validation
    return NextResponse.redirect(`${origin}/`);
  }

  // No code present, redirect to login
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
