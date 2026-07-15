/**
 * Comeback Challenge API Route — Story 15.4 (FR31)
 *
 * GET /api/comeback — the user's active challenge (+ derived progress), or
 * creates one when a 7+ day absence qualifies (create-on-read; the partial
 * unique index makes concurrent GETs race-safe). Lazy expiry — no cron.
 * SELF-HEALS a target-reached challenge (15-4 review: savings-contribution
 * auto-logs fill the count outside the POST path, and a transiently-failed
 * completing POST must not strand a full progress bar) — state change only;
 * the one-shot celebration still rides POST envelopes exclusively.
 * Challenge state is this endpoint's CORE: read failures return 500
 * (error-as-empty poisons the SWR cache — 15-3 lesson).
 *
 * PATCH /api/comeback { action: 'dismiss' } (zod-validated) — the ONLY
 * client-driven transition. Completion is server-derived (never trust the
 * client).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isEligibleForChallenge } from '@/lib/ai/comebackEngine';
import { localDayKey } from '@/lib/ai/streakEngine';
import { getStreak } from '@/lib/services/streakService';
import { unlockAchievements } from '@/lib/services/achievementService';
import {
  completeChallengeIfEarned,
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

const patchSchema = z.object({ action: z.literal('dismiss') });

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
    let expiryFailed = false;

    if (latest?.status === 'active') {
      if (new Date(latest.expires_at).getTime() <= now.getTime()) {
        // Lazy expiry — on failure, DON'T create a replacement this request:
        // the 23505 re-read would hand back this expired-but-active row (15-4)
        await markStatus(user.id, latest.id, 'expired').catch((error) => {
          expiryFailed = true;
          logger.warn('ComebackAPI', 'lazy expiry failed (non-fatal):', error);
        });
      } else {
        challenge = latest;
      }
    }

    if (
      !challenge &&
      !expiryFailed &&
      isEligibleForChallenge(streak, latest, localDayKey(now))
    ) {
      challenge = await createChallenge(user.id, streak!.current_streak);
    }

    const loggedCount = challenge ? await countLogsSince(user.id, challenge.started_at) : 0;

    // Self-heal: target reached through a path that never evaluated completion
    if (challenge && loggedCount >= challenge.target_count) {
      const completion = await completeChallengeIfEarned(
        user.id,
        challenge,
        streak?.current_streak ?? 0
      ).catch((error) => {
        logger.warn('ComebackAPI', 'self-heal completion failed (non-fatal):', error);
        return null;
      });
      if (completion) {
        // Award Phoenix idempotently (no toast here — GET responses are
        // cacheable state; the badge appears in the gallery, and the next
        // POST's latest-completed repair signal covers the toast path)
        await unlockAchievements(user.id, ['comeback']).catch((error) => {
          logger.warn('ComebackAPI', 'Phoenix unlock failed (retryable):', error);
        });
        challenge = { ...challenge, status: 'completed' };
      }
    }

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

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
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
