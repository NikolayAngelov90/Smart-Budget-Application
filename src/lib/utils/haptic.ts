/**
 * Haptic Feedback Utility
 * Story 10-8: Mobile-Optimized Touch UI
 *
 * AC-10.8.6: Haptic feedback via navigator.vibrate with graceful degradation.
 * No-op on browsers that do not support the Vibration API.
 */

/**
 * Trigger haptic feedback using the Vibration API.
 * Silently no-ops on devices/browsers that do not support navigator.vibrate.
 *
 * @param pattern - Vibration duration in ms, or an array of [vibrate, pause, vibrate, ...] ms values.
 * @default 50
 */
export function triggerHaptic(pattern: number | number[] = 50): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
