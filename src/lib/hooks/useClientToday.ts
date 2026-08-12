'use client';

/**
 * The client's current local calendar day, kept live.
 *
 * Every dated SWR key embeds `?today=` so the server stops deriving month
 * windows from its UTC clock. Those keys were built with a bare
 * `clientTodayParam()` call during render, and the hooks' own docblocks claimed
 * that "rolls the cache over at local midnight, so an open tab picks up the new
 * day". It did not: nothing re-renders an idle tab, so the key stayed on
 * yesterday and `revalidateOnFocus` refetched that SAME stale key. On the 1st of
 * a month, a dashboard left open overnight showed last month — the exact failure
 * the parameter was introduced to fix.
 *
 * This hook re-renders when the local day actually changes, so the key rolls
 * over and SWR fetches the new window. Three triggers, because each covers a
 * case the others miss:
 *
 *   - a timer to the next local midnight (tab visible and idle);
 *   - `visibilitychange` (backgrounded tabs get their timers throttled, so the
 *     midnight timer alone is not dependable);
 *   - `focus` (a laptop resumed from sleep fires focus but may not fire a
 *     timer that was due while suspended).
 *
 * Returns a `yyyy-MM-dd` string, identical in shape to `clientTodayParam()`.
 */

import { useEffect, useState } from 'react';
import { clientTimeZoneParam, clientTodayParam } from '@/lib/utils/date';

/**
 * The query-string fragment every dated request should carry.
 *
 * `tz` is what the server actually trusts — it derives the day from its own
 * clock in that zone, so a wrong device clock cannot shift the window (HP-7).
 * `today` is still sent so a request stays interpretable if the zone is one the
 * server's ICU data does not know.
 */
export function useDatedParams(): string {
  const today = useClientToday();
  const tz = clientTimeZoneParam();
  return tz ? `today=${today}&tz=${encodeURIComponent(tz)}` : `today=${today}`;
}

/** Milliseconds until the next local midnight, floored so it never returns 0. */
function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(next.getTime() - now.getTime(), 1000);
}

export function useClientToday(): string {
  const [today, setToday] = useState(clientTodayParam);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // `setToday` with the same string is a no-op in React, so these can fire
    // freely without causing renders.
    const sync = () => setToday(clientTodayParam());

    const scheduleMidnight = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sync();
        scheduleMidnight();
      }, msUntilLocalMidnight());
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sync();
        // Re-arm: a throttled background timer may have drifted or not fired.
        scheduleMidnight();
      }
    };

    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return today;
}
