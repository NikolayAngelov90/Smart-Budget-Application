/**
 * Weekly Digest API Route
 * Story 11.7: Weekly Financial Digest
 *
 * GET /api/user/digest — Fetch the latest weekly digest for the authenticated user.
 * Returns { data: WeeklyDigest } if a digest exists, or { data: null } if not yet generated.
 * Progressive disclosure: 200 with null data is intentional (not a 404).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLatestDigest } from '@/lib/services/digestService';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const digest = await getLatestDigest(supabase, user.id);

    return NextResponse.json({ data: digest }, { status: 200 });
  } catch (error) {
    logger.error('DigestRoute', 'Failed to fetch digest:', error);
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    );
  }
}
