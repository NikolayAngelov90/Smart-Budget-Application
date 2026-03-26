/**
 * API Route: Subscription Status Update
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 *
 * PATCH /api/subscriptions/:id - Update subscription status (dismiss/keep)
 *
 * Security:
 * - Authentication required (Supabase session)
 * - Row Level Security enforced (user can only modify own subscriptions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { updateSubscriptionStatus } from '@/lib/services/subscriptionService';
import { logger } from '@/lib/utils/logger';

const VALID_STATUSES = ['dismissed', 'kept'] as const;

const updateSubscriptionSchema = z.object({
  status: z.enum(VALID_STATUSES, {
    error: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
  }),
});

/**
 * PATCH /api/subscriptions/:id
 * Update subscription status to dismissed or kept.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Validate request body
    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await updateSubscriptionStatus(supabase, user.id, id, parsed.data.status);

    if (!updated) {
      return NextResponse.json(
        { error: { message: 'Subscription not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('SubscriptionsAPI', 'Error updating subscription:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to update subscription',
        },
      },
      { status: 500 }
    );
  }
}
