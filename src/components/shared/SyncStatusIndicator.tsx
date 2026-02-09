/**
 * Story 8.4: Data Sync Status and Multi-Device Information
 * Component: SyncStatusIndicator
 *
 * Displays sync status with real-time updates
 * AC-8.4.1: Sync Status Indicator
 * AC-8.4.2: Last Sync Timestamp
 * AC-8.4.6: Mobile Display
 */

'use client';

import React from 'react';
import { Badge, HStack, Text, Tooltip, Icon } from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon, TimeIcon } from '@chakra-ui/icons';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

export interface SyncStatusIndicatorProps {
  /**
   * Compact mode shows only the icon and status (for mobile/header)
   * Default false shows full status with timestamp
   */
  compact?: boolean;

  /**
   * Show last sync time below status
   * Only applies when compact is false
   */
  showTimestamp?: boolean;
}

/**
 * Displays current sync status with visual indicator
 *
 * Status states:
 * - Green "✓ All data synced" when online and synced
 * - Yellow "Syncing..." when operations pending
 * - Red "Offline" when no network connection
 *
 * Shows last sync timestamp on hover (compact mode) or below (full mode)
 */
export function SyncStatusIndicator({
  compact = false,
  showTimestamp = true,
}: SyncStatusIndicatorProps) {
  const { lastSync, syncStatus } = useOnlineStatus();
  const t = useTranslations('sync');

  // Format last sync time as "X minutes ago"
  const lastSyncText = lastSync
    ? t('lastSynced', { time: formatDistanceToNow(lastSync, { addSuffix: true }) })
    : t('neverSynced');

  // Determine badge color, icon, and text based on sync status
  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          colorScheme: 'green',
          icon: CheckCircleIcon,
          text: t('allDataSynced'),
          iconColor: 'green.500',
        };
      case 'syncing':
        return {
          colorScheme: 'yellow',
          icon: TimeIcon,
          text: t('syncing'),
          iconColor: 'yellow.500',
        };
      case 'offline':
        return {
          colorScheme: 'red',
          icon: WarningIcon,
          text: t('offline'),
          iconColor: 'red.500',
        };
      default:
        return {
          colorScheme: 'gray',
          icon: TimeIcon,
          text: t('unknown'),
          iconColor: 'gray.500',
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  // Compact mode: Icon + Badge (for mobile/header)
  if (compact) {
    return (
      <Tooltip label={lastSyncText} placement="bottom">
        <HStack spacing={2} cursor="pointer">
          <Icon as={StatusIcon} color={config.iconColor} boxSize={4} />
          <Badge colorScheme={config.colorScheme} fontSize="xs">
            {config.text}
          </Badge>
        </HStack>
      </Tooltip>
    );
  }

  // Full mode: Icon + Text + Optional Timestamp
  return (
    <HStack spacing={3} align="start">
      <Icon as={StatusIcon} color={config.iconColor} boxSize={5} mt={0.5} />
      <div>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="medium">
            {config.text}
          </Text>
          {syncStatus === 'offline' && (
            <Badge colorScheme={config.colorScheme} fontSize="xs">
              {t('noConnection')}
            </Badge>
          )}
        </HStack>
        {showTimestamp && lastSync && (
          <Text fontSize="xs" color="gray.600" mt={1}>
            {lastSyncText}
          </Text>
        )}
      </div>
    </HStack>
  );
}
