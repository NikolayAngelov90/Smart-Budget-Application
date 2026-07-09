/**
 * API Route: Logging streak (Story 15.1 / FR28)
 *
 * GET /api/streaks - the caller's streak state (null before the first log).
 * Read-only: streaks advance server-side inside POST /api/transactions.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStreak } from '@/lib/services/streakService';
import { logger } from '@/lib/utils/logger';
import type { StreakResponse } from '@/types/database.types';

export const dynamic = 'force-dynamic';

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

    const streak = await getStreak(user.id);
    const response: StreakResponse = { streak };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Streaks', 'GET failed:', error);
    return NextResponse.json({ error: { message: 'Failed to load streak' } }, { status: 500 });
  }
}
