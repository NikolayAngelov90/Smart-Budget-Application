/**
 * Story 8.5: Offline Data Caching for Viewing (Phase 1)
 * Component: OfflineBanner
 *
 * AC-8.5.2: Offline Indicator
 * - Banner displays: "You're offline. Viewing cached data from [timestamp]"
 *
 * AC-8.5.4: Reconnection Behavior
 * - Banner updates: "Back online! Syncing latest data..." when connection restored
 * - Auto-hide reconnection banner after 3 seconds
 */

'use client';

import { Alert, AlertIcon, AlertDescription, CloseButton } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export function OfflineBanner() {
  const { isOnline, cachedDataTimestamp, syncStatus } = useOnlineStatus();
  const t = useTranslations('offline');
  const [showReconnectionBanner, setShowReconnectionBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track reconnection: when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      // Just reconnected
      setShowReconnectionBanner(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnectionBanner(false);
      }, 3000);

      return () => clearTimeout(timer);
    }

    if (!isOnline) {
      setWasOffline(true);
    } else {
      // Reset wasOffline after reconnection banner disappears
      const timer = setTimeout(() => {
        setWasOffline(false);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show "Back online! Syncing..." banner when reconnecting
  if (showReconnectionBanner && isOnline) {
    return (
      <Alert status="success" variant="solid" position="sticky" top={0} zIndex={1000}>
        <AlertIcon />
        <AlertDescription flex="1">
          {syncStatus === 'syncing'
            ? t('backOnlineSyncing')
            : t('backOnlineSynced')}
        </AlertDescription>
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={() => setShowReconnectionBanner(false)}
        />
      </Alert>
    );
  }

  // Show "You're offline..." banner when offline
  if (!isOnline) {
    const cacheTimeText = cachedDataTimestamp
      ? formatDistanceToNow(cachedDataTimestamp, { addSuffix: true })
      : 'unknown';

    return (
      <Alert status="warning" variant="solid" position="sticky" top={0} zIndex={1000}>
        <AlertIcon />
        <AlertDescription flex="1">
          {t('youAreOffline', { time: cacheTimeText })}
        </AlertDescription>
      </Alert>
    );
  }

  // Online and not showing reconnection banner - no banner
  return null;
}
