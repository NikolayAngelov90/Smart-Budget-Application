'use client';

/**
 * AccountNoticesCard (spec-account-deletion-notifications).
 *
 * What an account deletion or a member's removal changed for the person
 * reading: a new owner, copies of categories, a renamed shared category, shared
 * goals or budgets now theirs. Shown until dismissed (no expiry). At most three
 * at a time, biggest change first; the rest are counted and appear as earlier
 * ones are dismissed.
 *
 * The text comes from messages/{en,bg}.json in the UI language. A notice whose
 * params cannot fill its text is not shown, so the card never shows a hole.
 *
 * Accessibility, as FeatureIntroCard: a section landmark + a heading per notice
 * + keyboard-reachable buttons. NOT aria-live, because a live region that mounts
 * with its content over-announces (15-8 review).
 */

import { Box, Button, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountNotices } from '@/lib/hooks/useAccountNotices';
import { noticeMessage } from '@/lib/accountNotices/noticeMessage';

export const MAX_VISIBLE_NOTICES = 3;

export function AccountNoticesCard() {
  const t = useTranslations('accountNotices');
  const locale = useLocale();
  const { notices, dismiss } = useAccountNotices();

  const shown = notices.flatMap((notice) => {
    const message = noticeMessage(notice, locale);
    return message ? [{ notice, message }] : [];
  });
  if (shown.length === 0) return null;

  const visible = shown.slice(0, MAX_VISIBLE_NOTICES);
  const more = shown.length - visible.length;

  return (
    <Box as="section" aria-label={t('cardLabel')} mb={{ base: 6, md: 8 }}>
      <VStack align="stretch" spacing={3}>
        {visible.map(({ notice, message }) => (
          <Box
            key={notice.id}
            bg="accent.subtle"
            border="1px solid"
            borderColor="accent"
            borderRadius="xl"
            p={{ base: 4, md: 5 }}
          >
            <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
              <Box flex="1" minW="0">
                <Heading as="h3" size="sm" color="fg" mb={1}>
                  {t(message.titleKey, message.values)}
                </Heading>
                <Text color="fg" fontSize="sm">
                  {t(message.bodyKey, message.values)}
                </Text>
              </Box>
              <Button
                variant="ghost"
                size="sm"
                minH="44px"
                flexShrink={0}
                onClick={() => void dismiss(notice.id)}
              >
                {t('dismiss')}
              </Button>
            </Flex>
          </Box>
        ))}
        {more > 0 && (
          <Text fontSize="sm" color="fg.muted">
            {t('more', { count: more })}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
