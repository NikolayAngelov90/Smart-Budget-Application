/**
 * App Badge Utility
 * Story 10-7: Enhanced PWA for Mobile Production
 *
 * AC-10.7.8: App icon badge showing unread insights count.
 * Uses the Badging API (navigator.setAppBadge / clearAppBadge).
 * Gracefully degrades on unsupported browsers.
 */

/**
 * Check if the Badging API is supported in the current browser
 */
export function isBadgeSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'setAppBadge' in navigator &&
    'clearAppBadge' in navigator
  );
}

/**
 * Set the app icon badge count
 * Shows the specified count on the app icon (where supported).
 *
 * @param count - Number to display on the badge (0 clears the badge)
 * @returns true if badge was set successfully, false if not supported
 */
export async function setAppBadge(count: number): Promise<boolean> {
  if (!isBadgeSupported()) return false;

  try {
    if (count <= 0) {
      await navigator.clearAppBadge();
    } else {
      await navigator.setAppBadge(count);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the app icon badge
 * Removes any badge count from the app icon.
 *
 * @returns true if badge was cleared successfully, false if not supported
 */
export async function clearAppBadge(): Promise<boolean> {
  if (!isBadgeSupported()) return false;

  try {
    await navigator.clearAppBadge();
    return true;
  } catch {
    return false;
  }
}
