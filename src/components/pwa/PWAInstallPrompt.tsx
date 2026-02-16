'use client';

/**
 * PWA Install Prompt Component
 * Story 10-7: Enhanced PWA for Mobile Production
 *
 * AC-10.7.4: Smart install banner — prompts after 3rd visit or 2 minutes engagement.
 * Uses BeforeInstallPromptEvent API for native install flow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  CloseButton,
  Flex,
  Text,
  Slide,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

/** localStorage keys for install prompt tracking */
const VISIT_COUNT_KEY = 'pwa-visit-count';
const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
const INSTALL_ACCEPTED_KEY = 'pwa-installed';

/** Minimum visits before showing prompt */
const MIN_VISITS = 3;

/** Minimum engagement time in ms before showing prompt (2 minutes) */
const MIN_ENGAGEMENT_MS = 2 * 60 * 1000;

/** Days to wait before showing prompt again after dismissal */
const DISMISS_COOLDOWN_DAYS = 7;

/**
 * BeforeInstallPromptEvent type (not in standard lib)
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const t = useTranslations('pwa');
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const engagementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if app is already installed (standalone mode)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as Record<string, unknown>).standalone === true));

  const shouldShowPrompt = useCallback((): boolean => {
    if (isStandalone) return false;
    if (typeof window === 'undefined') return false;

    // Already installed or accepted
    if (localStorage.getItem(INSTALL_ACCEPTED_KEY) === 'true') return false;

    // Check dismissal cooldown
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_COOLDOWN_DAYS) return false;
    }

    // Check visit count threshold
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    return visitCount >= MIN_VISITS;
  }, [isStandalone]);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone) return;

    // Increment visit count
    const currentCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    localStorage.setItem(VISIT_COUNT_KEY, String(currentCount + 1));

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt if visit threshold met
      if (shouldShowPrompt()) {
        setShowPrompt(true);
      }
    };

    // Also show after engagement time if visit threshold not yet met
    engagementTimer.current = setTimeout(() => {
      if (deferredPrompt && !showPrompt) {
        const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
        if (visitCount < MIN_VISITS) {
          // Engagement time reached, show even if visits not met
          setShowPrompt(true);
        }
      }
    }, MIN_ENGAGEMENT_MS);

    // Listen for app installed event
    const handleAppInstalled = () => {
      localStorage.setItem(INSTALL_ACCEPTED_KEY, 'true');
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (engagementTimer.current) {
        clearTimeout(engagementTimer.current);
      }
    };
  }, [isStandalone, shouldShowPrompt, deferredPrompt, showPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      localStorage.setItem(INSTALL_ACCEPTED_KEY, 'true');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <Slide direction="bottom" in={showPrompt} style={{ zIndex: 1500 }}>
      <Box
        bg="blue.600"
        color="white"
        px={4}
        py={3}
        shadow="lg"
        pb={`max(12px, env(safe-area-inset-bottom))`}
      >
        <Flex align="center" justify="space-between" maxW="container.xl" mx="auto">
          <Box flex={1} mr={3}>
            <Text fontWeight="bold" fontSize="sm">
              {t('installTitle')}
            </Text>
            <Text fontSize="xs" opacity={0.9}>
              {t('installDescription')}
            </Text>
          </Box>
          <Flex align="center" gap={2}>
            <Button
              size="sm"
              colorScheme="whiteAlpha"
              variant="solid"
              onClick={handleInstall}
              fontWeight="bold"
            >
              {t('install')}
            </Button>
            <CloseButton size="sm" onClick={handleDismiss} />
          </Flex>
        </Flex>
      </Box>
    </Slide>
  );
}

// Export constants for testing
export const PWA_CONSTANTS = {
  VISIT_COUNT_KEY,
  INSTALL_DISMISSED_KEY,
  INSTALL_ACCEPTED_KEY,
  MIN_VISITS,
  MIN_ENGAGEMENT_MS,
  DISMISS_COOLDOWN_DAYS,
};
