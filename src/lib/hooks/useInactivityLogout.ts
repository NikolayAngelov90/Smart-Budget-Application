import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Inactivity Logout Hook
 * Story 2.5: Session Management and Auto-Logout
 *
 * Tracks user activity and triggers auto-logout after inactivity period.
 * Shows warning modal 5 minutes before logout.
 *
 * Usage:
 * ```tsx
 * const { showWarning, timeRemaining, extend Session, logout } = useInactivityLogout();
 * ```
 *
 * Features:
 * - Tracks mouse movement, keypress, and clicks
 * - Warning at 25 minutes of inactivity
 * - Auto-logout at 30 minutes of inactivity
 * - Multi-tab synchronization via BroadcastChannel
 */

const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // 25 minutes
const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useInactivityLogout() {
  const router = useRouter();
  const supabase = createClient();

  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(WARNING_DURATION_MS / 1000); // seconds

  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Logout function
  const logout = useCallback(
    async (reason: 'inactivity' | 'manual' = 'inactivity') => {
      clearTimers();
      setShowWarning(false);

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Broadcast logout to other tabs
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'logout', reason });
      }

      // Redirect to login with message
      if (reason === 'inactivity') {
        router.push('/login?message=inactivity');
      } else {
        router.push('/login');
      }
    },
    [router, supabase.auth, clearTimers]
  );

  // Start countdown in warning modal
  const startCountdown = useCallback(() => {
    setTimeRemaining(WARNING_DURATION_MS / 1000);

    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up - logout
          logout('inactivity');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [logout]);

  // Reset inactivity timers
  const resetTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);

    // Set warning timer (25 minutes)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, INACTIVITY_WARNING_MS);

    // Set logout timer (30 minutes total)
    logoutTimerRef.current = setTimeout(() => {
      logout('inactivity');
    }, INACTIVITY_LOGOUT_MS);
  }, [clearTimers, startCountdown, logout]);

  // Extend session (called when user clicks "Stay logged in")
  const extendSession = useCallback(() => {
    setShowWarning(false);
    resetTimers();

    // Broadcast session extension to other tabs
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'extend' });
    }
  }, [resetTimers]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetTimers();
    }
  }, [showWarning, resetTimers]);

  // Setup activity listeners and broadcast channel
  useEffect(() => {
    // Initialize broadcast channel for multi-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      broadcastChannelRef.current = new BroadcastChannel('auth-channel');

      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.type === 'logout') {
          // Another tab logged out - logout this tab too
          clearTimers();
          setShowWarning(false);
          router.push('/login');
        } else if (event.data.type === 'extend') {
          // Another tab extended session - extend this tab too
          setShowWarning(false);
          resetTimers();
        }
      };
    }

    // Activity event listeners
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart'];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Start initial timers
    resetTimers();

    // Cleanup
    return () => {
      clearTimers();
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [handleActivity, resetTimers, clearTimers, router]);

  return {
    showWarning,
    timeRemaining,
    extendSession,
    logout: () => logout('manual'),
  };
}
