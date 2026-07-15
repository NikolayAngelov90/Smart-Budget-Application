/**
 * Comeback Challenge API Route — Story 15.4 (FR31)
 *
 * GET /api/comeback — the user's active challenge (+ derived progress), or
 * creates one when a 7+ day absence qualifies (create-on-read; the partial
 * unique index makes concurrent GETs race-safe). Lazy expiry — no cron.
 * Challenge state is this endpoint's CORE: read failures return 500
 * (15-3 lesson — error-as-empty poisons the SWR cache).
 *
 * PATCH /api/comeback { action: 'dismiss' } — the ONLY client-driven
 * transition. Completion is server-derived in the tx POST (never trust
 * the client).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isEligibleForChallenge } from '@/lib/ai/comebackEngine';
import { localDayKey } from '@/lib/ai/streakEngine';
import { getStreak } from '@/lib/services/streakService';
import {
  countLogsSince,
  createChallenge,
  getActiveChallenge,
  getLatestChallenge,
  markStatus,
} from '@/lib/services/comebackService';
import { logger } from '@/lib/utils/logger';
import type { ComebackChallenge, ComebackResponse } from '@/types/database.types';

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

    const now = new Date();
    const [streak, latest] = await Promise.all([
      // Streak is the eligibility SIGNAL, not this endpoint's core — a broken
      // streaks read means "can't offer a challenge", never a 500
      getStreak(user.id).catch((error) => {
        logger.warn('ComebackAPI', 'streaks unavailable, no challenge offer:', error);
        return null;
      }),
      getLatestChallenge(user.id),
    ]);

    let challenge: ComebackChallenge | null = null;

    if (latest?.status === 'active') {
      if (new Date(latest.expires_at).getTime() <= now.getTime()) {
        // Lazy expiry — best-effort; a failed write just retries next read
        await markStatus(user.id, latest.id, 'expired').catch((error) => {
          logger.warn('ComebackAPI', 'lazy expiry failed (non-fatal):', error);
        });
      } else {
        challenge = latest;
      }
    }

    if (!challenge && isEligibleForChallenge(streak, latest, localDayKey(now))) {
      challenge = await createChallenge(user.id, streak!.current_streak);
    }

    const loggedCount = challenge ? await countLogsSince(user.id, challenge.started_at) : 0;

    const response: ComebackResponse = { challenge, loggedCount };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('ComebackAPI', 'Error loading comeback challenge:', error);
    return NextResponse.json(
      { error: { message: 'Failed to load comeback challenge' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    if (body?.action !== 'dismiss') {
      return NextResponse.json({ error: { message: 'Invalid action' } }, { status: 400 });
    }

    const active = await getActiveChallenge(user.id);
    if (!active) {
      return NextResponse.json({ error: { message: 'No active challenge' } }, { status: 404 });
    }

    await markStatus(user.id, active.id, 'dismissed');
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('ComebackAPI', 'Error dismissing comeback challenge:', error);
    return NextResponse.json(
      { error: { message: 'Failed to dismiss comeback challenge' } },
      { status: 500 }
    );
  }
}
