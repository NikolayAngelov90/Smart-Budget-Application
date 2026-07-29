'use client';

/**
 * Renders the three states the pre-split settings page rendered at the top of
 * the whole screen: a spinner while mounting/loading, an error with a retry
 * when the profile cannot be loaded, and otherwise the section itself.
 *
 * The loading branch also guards hydration — sections driven by client-only
 * state (cookies, push/browser APIs) render different trees on the server and
 * the client without it.
 *
 * The FAILED branch matters just as much and is easy to lose: the profile
 * fetch clears its loading flag on the error path too, so a spinner-only gate
 * opens onto a null profile. The user then sees hardcoded defaults presented
 * as their saved settings, and every control silently discards its write.
 */

import { Alert, AlertIcon, Button, Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { SettingsProfileStatus } from '@/lib/hooks/useSettingsProfile';

interface SettingsSectionGateProps {
  status: SettingsProfileStatus;
  /** Shown under the alert when the failure carried a message. */
  error?: Error | null;
  /** Retries the profile fetch in place; falls back to a reload when absent. */
  onRetry?: () => void;
  children: React.ReactNode;
}

export function SettingsSectionGate({
  status,
  error,
  onRetry,
  children,
}: SettingsSectionGateProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  if (status === 'loading') {
    return (
      <Center py={12}>
        <VStack spacing={4}>
          <Spinner size="xl" color="accent" />
          <Text color="fg.muted">{tCommon('loading')}</Text>
        </VStack>
      </Center>
    );
  }

  if (status === 'failed') {
    return (
      <VStack spacing={4} align="stretch">
        <Alert status="error">
          <AlertIcon />
          {t('failedToLoadProfile')}
        </Alert>
        {error && (
          <Text fontSize="sm" color="fg.subtle">
            {error.message}
          </Text>
        )}
        <Button
          colorScheme="brand"
          alignSelf="start"
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
        >
          {tCommon('retry')}
        </Button>
      </VStack>
    );
  }

  return <>{children}</>;
}
