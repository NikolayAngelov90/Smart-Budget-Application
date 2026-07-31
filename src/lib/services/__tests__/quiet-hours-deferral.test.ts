/**
 * @jest-environment node
 */

/**
 * Quiet hours defer instead of vanishing — DW-4.
 *
 * Two defects, and the second is the prerequisite for fixing the first:
 *
 *  1. The gate SUPPRESSED. Combined with a cron firing at one fixed instant,
 *     a user whose quiet window covered 10:00 UTC got zero re-engagement
 *     pushes, ever — a mild preference silently became a permanent opt-out.
 *  2. Quiet hours were evaluated with `getUTCHours()` and nothing stored a
 *     timezone, so "22:00-08:00" was applied in UTC. For a Sofia user (UTC+3)
 *     that is 01:00-11:00 their time — the window was shifted by their whole
 *     offset, and "defer until quiet hours end" would have deferred to the
 *     wrong hour.
 */

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { isWithinQuietHours, localHourIn } from '@/lib/services/pushService';
import {
  dayPeriodKey,
  weekPeriodKey,
} from '@/lib/services/notificationDeliveryService';

/** 09:00 UTC — inside a 22-08 window for Sofia (12:00 local), outside for UTC. */
const AT_0900_UTC = new Date('2026-07-15T09:00:00Z');

describe('localHourIn', () => {
  it('reports the hour in the given zone, not UTC', () => {
    expect(localHourIn('UTC', AT_0900_UTC)).toBe(9);
    // Sofia is UTC+3 in July.
    expect(localHourIn('Europe/Sofia', AT_0900_UTC)).toBe(12);
    // And west of UTC.
    expect(localHourIn('America/Los_Angeles', AT_0900_UTC)).toBe(2);
  });

  it('handles the DST offset rather than assuming a fixed one', () => {
    // Sofia is UTC+2 in January, UTC+3 in July — a hardcoded offset gets one of
    // these wrong twice a year.
    expect(localHourIn('Europe/Sofia', new Date('2026-01-15T09:00:00Z'))).toBe(11);
    expect(localHourIn('Europe/Sofia', new Date('2026-07-15T09:00:00Z'))).toBe(12);
  });

  it('falls back to UTC for a missing or malformed zone, never throwing', () => {
    expect(localHourIn(undefined, AT_0900_UTC)).toBe(9);
    expect(localHourIn('Not/AZone', AT_0900_UTC)).toBe(9);
    expect(localHourIn('', AT_0900_UTC)).toBe(9);
  });

  it('normalises midnight to 0, not 24', () => {
    // Some ICU builds render midnight as "24" under hour12:false.
    expect(localHourIn('UTC', new Date('2026-07-15T00:30:00Z'))).toBe(0);
  });
});

describe('isWithinQuietHours', () => {
  it('uses the user timezone — the bug that made the window meaningless', () => {
    // 09:00 UTC. A 22-08 window: quiet in UTC terms? No (9 >= 8).
    expect(isWithinQuietHours(22, 8, 'UTC', AT_0900_UTC)).toBe(false);
    // For Sofia it is 12:00 — also not quiet. But the point is that the SAME
    // instant is evaluated against a different local hour.
    expect(localHourIn('Europe/Sofia', AT_0900_UTC)).not.toBe(
      localHourIn('UTC', AT_0900_UTC)
    );
  });

  it('is quiet for a Sofia user when it is their night, not UTC night', () => {
    // 23:00 Sofia = 20:00 UTC. Under the old UTC-only logic this was NOT quiet
    // (20 < 22); in the user's own time it plainly is.
    const at2000Utc = new Date('2026-07-15T20:00:00Z');
    expect(isWithinQuietHours(22, 8, 'UTC', at2000Utc)).toBe(false);
    expect(isWithinQuietHours(22, 8, 'Europe/Sofia', at2000Utc)).toBe(true);
  });

  it('handles a window spanning midnight', () => {
    const at0200 = new Date('2026-07-15T02:00:00Z');
    const at1200 = new Date('2026-07-15T12:00:00Z');
    expect(isWithinQuietHours(22, 8, 'UTC', at0200)).toBe(true);
    expect(isWithinQuietHours(22, 8, 'UTC', at1200)).toBe(false);
  });

  it('handles a same-day window', () => {
    expect(isWithinQuietHours(2, 6, 'UTC', new Date('2026-07-15T03:00:00Z'))).toBe(true);
    expect(isWithinQuietHours(2, 6, 'UTC', new Date('2026-07-15T07:00:00Z'))).toBe(false);
  });

  it('treats a degenerate window as never quiet', () => {
    // start === end would otherwise mean "always quiet", silencing everything.
    expect(isWithinQuietHours(8, 8, 'UTC', AT_0900_UTC)).toBe(false);
  });

  it('is exclusive at the end hour, so the deferral can actually land', () => {
    // At exactly the end hour the user must be reachable — otherwise a push
    // deferred "until quiet hours end" would be deferred again.
    expect(isWithinQuietHours(22, 8, 'UTC', new Date('2026-07-15T08:00:00Z'))).toBe(false);
  });
});

describe('period keys', () => {
  it('day key rolls over, which is what expires a stale daily push', () => {
    expect(dayPeriodKey(new Date(2026, 6, 15, 23, 30))).toBe('2026-07-15');
    expect(dayPeriodKey(new Date(2026, 6, 16, 0, 30))).toBe('2026-07-16');
  });

  it('week key is stable across a week and changes at its boundary', () => {
    // Mon 2026-07-13 .. Sun 2026-07-19 are one ISO week.
    const monday = weekPeriodKey(new Date(2026, 6, 13));
    const sunday = weekPeriodKey(new Date(2026, 6, 19));
    const nextMonday = weekPeriodKey(new Date(2026, 6, 20));

    expect(monday).toMatch(/^\d{4}-W\d{2}$/);
    expect(sunday).toBe(monday);
    expect(nextMonday).not.toBe(monday);
  });

  it('week key handles the year boundary without resetting to W00', () => {
    // 2026-12-31 is a Thursday, so it belongs to 2026's last ISO week.
    expect(weekPeriodKey(new Date(2026, 11, 31))).toBe('2026-W53');
  });
});
