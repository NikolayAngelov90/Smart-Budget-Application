/**
 * Achievements API Route — Story 15.3 (FR30)
 *
 * GET /api/achievements — the caller's unlocked achievements for the gallery.
 * The unlocked list IS this endpoint's core input: a read failure returns 500
 * (degradation policy — error-as-empty would render every badge "Locked" and
 * poison the SWR cache with authoritative emptiness; a 500 lets
 * keepPreviousData hold the last known truth). Empty ≠ error: a user with no
 * unlocks still gets 200 [].
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUnlocked } from '@/lib/services/achievementService';
import { logger } from '@/lib/utils/logger';
import type { AchievementsResponse } from '@/types/database.types';

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

    const achievements = await getUnlocked(user.id);

    const response: AchievementsResponse = { achievements };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('AchievementsAPI', 'Error loading achievements:', error);
    return NextResponse.json(
      { error: { message: 'Failed to load achievements' } },
      { status: 500 }
    );
  }
}
