/**
 * useSmartNudge — Story 12.3
 *
 * Stores the current nudge payload to display; cleared on dismiss.
 * Shared between the transaction modal (sets nudge) and the nudge
 * banner component (reads nudge).
 */

'use client';

import { useState, useCallback } from 'react';
import type { NudgePayload } from '@/types/database.types';

export interface UseSmartNudgeResult {
  nudge: NudgePayload | null;
  showNudge: (payload: NudgePayload) => void;
  dismissNudge: () => void;
}

export function useSmartNudge(): UseSmartNudgeResult {
  const [nudge, setNudge] = useState<NudgePayload | null>(null);

  const showNudge = useCallback((payload: NudgePayload) => {
    setNudge(payload);
  }, []);

  const dismissNudge = useCallback(() => {
    setNudge(null);
  }, []);

  return { nudge, showNudge, dismissNudge };
}
