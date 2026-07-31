/**
 * @jest-environment node
 */

/**
 * Cron schedules must stay within the Vercel plan's limits.
 *
 * DW-4 set two crons to hourly (`0 * * * *` and `0 * * * 1`) to make a deferred
 * push recoverable. That is correct engineering and an invalid deployment: this
 * project is on a Hobby account, which permits **one run per day per cron**.
 * The build passed, every test passed, and the failure appeared only at
 * `vercel deploy` — after merge.
 *
 * A schedule is a deployment constraint, not just configuration, so it gets a
 * test like anything else that can break a deploy.
 */

import fs from 'fs';
import path from 'path';

const VERCEL_JSON = path.resolve(__dirname, '../../../../vercel.json');

interface CronEntry {
  path: string;
  schedule: string;
}

function readCrons(): CronEntry[] {
  const raw = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8')) as { crons?: CronEntry[] };
  return raw.crons ?? [];
}

/**
 * A cron runs at most once a day only when BOTH minute and hour are a single
 * fixed value. A wildcard, a step or a comma-list in those fields multiplies the
 * runs within a day — which is exactly what Vercel rejects.
 */
function runsAtMostOncePerDay(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/);
  const isFixed = (field: string | undefined) =>
    !!field && /^\d+$/.test(field);
  return isFixed(minute) && isFixed(hour);
}

describe('vercel.json cron schedules', () => {
  const crons = readCrons();

  it('defines at least one cron (guards against reading the wrong file)', () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it.each(readCrons().map((c) => [c.path, c.schedule]))(
    '%s (%s) runs at most once per day — Hobby plan limit',
    (_p, schedule) => {
      expect(runsAtMostOncePerDay(schedule as string)).toBe(true);
    }
  );

  it('rejects the exact expressions that failed the deploy', () => {
    // Regression lock on the real failure: `0 * * * 1` produced
    // "Hobby accounts are limited to daily cron jobs".
    expect(runsAtMostOncePerDay('0 * * * 1')).toBe(false);
    expect(runsAtMostOncePerDay('0 * * * *')).toBe(false);
    expect(runsAtMostOncePerDay('*/15 * * * *')).toBe(false);
    expect(runsAtMostOncePerDay('0 9,21 * * *')).toBe(false);
  });

  it('accepts once-daily and once-weekly forms', () => {
    expect(runsAtMostOncePerDay('0 9 * * *')).toBe(true);
    expect(runsAtMostOncePerDay('0 2 * * 0')).toBe(true);
    expect(runsAtMostOncePerDay('30 23 1 * *')).toBe(true);
  });

  it('gives every cron a distinct hour, so they do not contend', () => {
    // Not a platform rule — these all page the same tables, and stacking them
    // on one instant is how a slow run starves the next.
    const hours = crons.map((c) => c.schedule.trim().split(/\s+/)[1]);
    expect(new Set(hours).size).toBe(hours.length);
  });
});
