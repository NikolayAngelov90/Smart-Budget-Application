'use client';

/**
 * ComebackChallengeCard — Story 15.4 (FR31)
 *
 * Inline dashboard card for the active comeback challenge (UX: persistent
 * until completed/dismissed, manual dismiss — never a toast/overlay).
 * Copy celebrates the return; ZERO guilt words (AC4). Single mount point
 * (15-6 opt-out gates here later). Renders null unless a challenge is active.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Progress,
  Text,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useComeback } from '@/lib/hooks/useComeback';
import { RESTORE_FRACTION } from '@/lib/ai/comebackEngine';

export function ComebackChallengeCard() {
  const t = useTranslations('comeback');
  const { data, mutate } = useComeback();
  const [dismissing, setDismissing] = useState(false);

  const challenge = data?.challenge;
  if (!challenge || challenge.status !== 'active' || dismissing) return null;

  const loggedCount = Math.min(data?.loggedCount ?? 0, challenge.target_count);
  // The guaranteed restore floor — what completing brings back at minimum
  const restoreDays = Math.max(1, Math.floor(challenge.previous_streak * RESTORE_FRACTION));

  const handleDismiss = async () => {
    setDismissing(true); // optimistic hide; state persists server-side
    try {
      await fetch('/api/comeback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } finally {
      mutate().catch(() => {
        // Revalidation failure is non-fatal — the server row is dismissed
      });
    }
  };

  return (
    <Box
      as="section"
      aria-label={t('heading')}
      mb={{ base: 6, md: 8 }}
      p={5}
      borderWidth="2px"
      borderColor="orange.300"
      borderRadius="xl"
      bg="orange.50"
    >
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Box>
          <Heading as="h2" fontSize="1.125rem" color="orange.800">
            {t('heading')}
          </Heading>
          <Text fontSize="sm" color="gray.700" mt={1}>
            {t('body', { target: challenge.target_count })}
          </Text>
          <Text fontSize="xs" color="orange.700" mt={1}>
            {t('restorePromise', { days: restoreDays })}
          </Text>
        </Box>
        <Button size="xs" variant="ghost" colorScheme="orange" onClick={handleDismiss}>
          {t('dismiss')}
        </Button>
      </Flex>
      <Box mt={3}>
        <Progress
          value={(loggedCount / challenge.target_count) * 100}
          size="sm"
          colorScheme="orange"
          borderRadius="full"
          aria-label={t('progress', { count: loggedCount, target: challenge.target_count })}
        />
        <Text fontSize="xs" color="gray.600" mt={1}>
          {t('progress', { count: loggedCount, target: challenge.target_count })}
        </Text>
      </Box>
    </Box>
  );
}
