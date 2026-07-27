'use client';

/**
 * Renders a spinner until the settings profile is mounted AND loaded.
 *
 * The pre-split page did exactly this at the top of the whole screen. Without
 * it, sections driven by client-only state (cookies, push/browser APIs) render
 * different trees on the server and the client — a real hydration mismatch.
 */

import { Center, Spinner, VStack, Text } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';

interface SettingsSectionGateProps {
  isReady: boolean;
  children: React.ReactNode;
}

export function SettingsSectionGate({ isReady, children }: SettingsSectionGateProps) {
  const tCommon = useTranslations('common');

  if (!isReady) {
    return (
      <Center py={12}>
        <VStack spacing={4}>
          <Spinner size="xl" color="accent" />
          <Text color="fg.muted">{tCommon('loading')}</Text>
        </VStack>
      </Center>
    );
  }

  return <>{children}</>;
}
