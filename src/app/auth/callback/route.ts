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
import { logger } from '@/lib/utils/logger';
import { checkName } from '@/lib/validation/names';

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('AuthCallback', 'OAuth callback error:', error.message);
      // Redirect to login with error message
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`
      );
    }

    // Check if this is a new user and seed default categories
    if (data?.user) {
      const userId = data.user.id;

      // Check if user has any categories (to determine if they're new)
      // FIXED: Added .eq('user_id', userId) to filter by current user
      const { data: existingCategories } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      // If no categories exist, seed default categories for this new user
      if (!existingCategories || existingCategories.length === 0) {
        try {
          await supabase.rpc('seed_user_categories', {
            target_user_id: userId,
          });
          logger.info('AuthCallback', `Default categories seeded for new user: ${userId}`);
        } catch (seedError) {
          logger.error('AuthCallback', 'Failed to seed categories:', seedError);
          // Don't block login for seeding failure - categories can be added later
        }
      }

      // Story 11.1: Pre-fill display_name from OAuth metadata if available.
      // The provider's name follows the shared name rule (spec-cyrillic-names):
      // stored normalised, and only if it passes - a name the rule refuses (an
      // emoji, a zero-width joiner) is not pre-filled, the person can set one in
      // settings, and the database would refuse it anyway.
      const oauthDisplayName =
        data.user.user_metadata?.full_name || data.user.user_metadata?.name || null;
      const oauthName = oauthDisplayName ? checkName(oauthDisplayName, 'displayName') : null;

      if (oauthName?.ok) {
        try {
          // supabase-js RETURNS a refused write (e.g. the database CHECK) as
          // { error } rather than throwing it: log both.
          const { error: prefillError } = await supabase
            .from('user_profiles')
            .update({ display_name: oauthName.name })
            .eq('id', userId);
          if (prefillError) {
            logger.error('AuthCallback', 'Failed to pre-fill display name:', prefillError.message);
          }
        } catch (nameError) {
          logger.error('AuthCallback', 'Failed to pre-fill display name:', nameError);
        }
      } else if (oauthName) {
        logger.warn('AuthCallback', `OAuth display name not pre-filled: ${oauthName.problem}`);
      }
    }

    // Success! Redirect to dashboard (root route)
    // The middleware will handle session validation
    return NextResponse.redirect(`${origin}/`);
  }

  // No code present, redirect to login
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
