'use client';

/**
 * Refresh Insights Button Component
 *
 * Story 6.5: Insight Generation Scheduling and Manual Refresh
 * AC3: Manual Refresh Button - Available on insights page
 * AC5: Loading Indicator - Displays while generating
 * AC7: Cache Invalidation - Manual refresh bypasses 1-hour cache
 * AC8: Rate Limiting - Max 1 manual refresh per 5 minutes
 *
 * Features:
 * - Triggers manual insight generation with forceRegenerate=true
 * - Shows loading state with spinner during generation
 * - Displays success/error toasts with appropriate messages
 * - Handles rate limiting (429 error) and shows remaining time
 * - Mutates SWR cache to reload insights after successful generation
 * - Tracks last refresh time to prevent double-clicks
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, useToast } from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';
import { useSWRConfig } from 'swr';

interface RefreshInsightsButtonProps {
  /**
   * Optional custom button text (defaults to the localized "Refresh insights")
   */
  buttonText?: string;

  /**
   * Optional size variant for button
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Optional variant (default: "outline")
   */
  variant?: 'solid' | 'outline' | 'ghost';

  /**
   * Optional callback after successful refresh
   */
  onRefreshComplete?: (count: number) => void;
}

export function RefreshInsightsButton({
  buttonText,
  size = 'md',
  variant = 'outline',
  onRefreshComplete,
}: RefreshInsightsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const toast = useToast();
  // Story 16.4: the label was a hardcoded English default, so it stayed
  // "Refresh Insights" in the Bulgarian UI.
  const t = useTranslations('insights');
  // SCOPED mutate. The global `mutate` imported from 'swr' binds to SWR's own
  // default cache, while every hook in this app reads the localStorage cache
  // provider — so the old global call silently matched nothing and the list
  // never revalidated after a refresh.
  const { mutate } = useSWRConfig();

  const handleRefresh = async () => {
    // Prevent double-clicks (client-side check, 2 seconds)
    if (lastRefreshTime && Date.now() - lastRefreshTime < 2000) {
      return;
    }

    setIsLoading(true);
    setLastRefreshTime(Date.now());

    try {
      // Call generate endpoint with forceRegenerate=true to bypass cache
      const response = await fetch('/api/insights/generate?forceRegenerate=true', {
        method: 'POST',
      });

      const data = await response.json();

      // Handle rate limiting (429 error)
      if (response.status === 429) {
        const remainingSeconds = data.remainingSeconds || 0;
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;

        const timeString =
          minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        toast({
          title: 'Please wait',
          description: `Please wait before refreshing again. (${timeString} remaining)`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });

        return;
      }

      // Handle other errors
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh insights');
      }

      // Success handling
      const insightCount = data.count || 0;

      if (insightCount === 0) {
        // No new insights generated
        toast({
          title: t('refreshUpToDateTitle'),
          description: t('refreshUpToDateDesc'),
          status: 'info',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      } else {
        // New insights generated
        toast({
          title: t('refreshDoneTitle'),
          description: t('refreshDoneDesc', { count: insightCount }),
          status: 'success',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      }

      // Mutate SWR cache to reload insights
      // This will trigger revalidation of all insight-related endpoints
      mutate((key) => typeof key === 'string' && key.startsWith('/api/insights'));

      // Call callback if provided
      if (onRefreshComplete) {
        onRefreshComplete(insightCount);
      }
    } catch (error) {
      console.error('Error refreshing insights:', error);

      toast({
        title: t('refreshFailed'),
        description:
          error instanceof Error ? error.message : 'Failed to refresh insights. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      leftIcon={<RepeatIcon />}
      onClick={handleRefresh}
      isLoading={isLoading}
      loadingText={t('refreshing')}
      size={size}
      variant={variant}
      colorScheme="brand"
      aria-label={t('refresh')}
    >
      {buttonText ?? t('refresh')}
    </Button>
  );
}
