/**
 * API Route: Single wishlist item (Story 14.3 / FR15)
 *
 * PATCH /api/wishlist/:id { status } - mark an item active | purchased | removed
 * (soft status transitions; rows are never hard-deleted so history persists)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { updateStatus, WishlistItemNotFoundError } from '@/lib/services/wishlistService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['active', 'purchased', 'removed']),
});

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
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: { message: 'Invalid wishlist item id' } }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'status must be one of: active, purchased, removed' } },
        { status: 400 }
      );
    }

    const item = await updateStatus(user.id, id, parsed.data.status);
    return NextResponse.json({ data: item });
  } catch (error) {
    if (error instanceof WishlistItemNotFoundError) {
      return NextResponse.json({ error: { message: 'Wishlist item not found' } }, { status: 404 });
    }
    logger.error('Wishlist', 'PATCH failed:', error);
    return NextResponse.json({ error: { message: 'Failed to update wishlist item' } }, { status: 500 });
  }
}
