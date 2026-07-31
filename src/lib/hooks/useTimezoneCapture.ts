'use client';

/**
 * Keeps the stored IANA timezone in step with the browser — DW-4.
 *
 * Quiet hours are a per-account preference enforced by CRON jobs, where there
 * is no client to ask. So the zone has to be stored, and the only place that
 * knows it is the browser.
 *
 * Silent by design: the user never asked to configure a timezone, and asking
 * them to would be a worse experience than reading the one their device already
 * reports. It is surfaced (read-only) in Settings so it is discoverable rather
 * than hidden.
 */

import { useEffect, useRef } from 'react';

/** The browser's IANA zone, or undefined where Intl cannot report one. */
export function detectBrowserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

interface UseTimezoneCaptureArgs {
  /** The zone currently stored on the profile, if any. */
  storedTimezone: string | undefined;
  /** True once the profile has actually loaded — see the guard below. */
  isReady: boolean;
  onCapture: (timezone: string) => void | Promise<void>;
}

export function useTimezoneCapture({
  storedTimezone,
  isReady,
  onCapture,
}: UseTimezoneCaptureArgs): void {
  // One write per mount at most. Without this, a failed PUT would retry on
  // every render of a page the user is just sitting on.
  const attempted = useRef(false);

  useEffect(() => {
    // Waiting for `isReady` matters: before the profile loads `storedTimezone`
    // is undefined for every user, so writing here would fire for people who
    // already have a zone — and clobber a deliberately different one.
    if (!isReady || attempted.current) return;

    const detected = detectBrowserTimezone();
    if (!detected || detected === storedTimezone) return;

    attempted.current = true;
    void onCapture(detected);
  }, [isReady, storedTimezone, onCapture]);
}
