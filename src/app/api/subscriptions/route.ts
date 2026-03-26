/**
 * API Route: Subscription Management (List)
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * GET /api/subscriptions - List user's detected subscriptions
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionsForUser, hasEnoughHistory } from '@/lib/services/subscriptionService';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/subscriptions
 * Returns detected subscriptions for the authenticated user.
 * Includes a `hasHistory` flag for progressive disclosure.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const [subscriptions, eligible] = await Promise.all([
      getSubscriptionsForUser(supabase, user.id),
      hasEnoughHistory(user.id),
    ]);

    return NextResponse.json({
      data: subscriptions,
      hasHistory: eligible,
      count: subscriptions.length,
    });
  } catch (error) {
    logger.error('SubscriptionsAPI', 'Error fetching subscriptions:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to fetch subscriptions',
        },
      },
      { status: 500 }
    );
  }
}
