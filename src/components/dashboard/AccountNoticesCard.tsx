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
 * Accessibility, as FeatureIntroCard: a section landmark with its own heading,
 * a heading per notice, and keyboard-reachable buttons, each described by its
 * notice's heading (they all say "Got it"). Dismissing moves focus to the next
 * notice instead of dropping it on the page. NOT aria-live, because a live
 * region that mounts with its content over-announces (15-8 review).
 */

import { useEffect, useRef } from 'react';
import { Box, Button, Flex, Heading, Text, VisuallyHidden, VStack } from '@chakra-ui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountNotices } from '@/lib/hooks/useAccountNotices';
import { noticeMessage } from '@/lib/accountNotices/noticeMessage';

export const MAX_VISIBLE_NOTICES = 3;

export function AccountNoticesCard() {
  const t = useTranslations('accountNotices');
  const locale = useLocale();
  const { notices, dismiss } = useAccountNotices();
  const sectionRef = useRef<HTMLElement>(null);
  /** Where focus goes after a dismissal: the index of the notice that was dismissed. */
  const focusAfterDismiss = useRef<number | null>(null);

  const shown = notices.flatMap((notice) => {
    const message = noticeMessage(notice, locale);
    return message ? [{ notice, message }] : [];
  });
  const visible = shown.slice(0, MAX_VISIBLE_NOTICES);
  const more = shown.length - visible.length;
  const visibleKey = visible.map((v) => v.notice.id).join(',');

  useEffect(() => {
    const index = focusAfterDismiss.current;
    if (index === null) return;
    focusAfterDismiss.current = null;
    const buttons = sectionRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-notice-dismiss]'
    );
    if (buttons && buttons.length > 0) buttons[Math.min(index, buttons.length - 1)]!.focus();
  }, [visibleKey]);

  if (shown.length === 0) return null;

  return (
    <Box
      as="section"
      ref={sectionRef}
      aria-labelledby="account-notices-heading"
      mb={{ base: 6, md: 8 }}
    >
      <VisuallyHidden as="h2" id="account-notices-heading">
        {t('cardLabel')}
      </VisuallyHidden>
      <VStack align="stretch" spacing={3}>
        {visible.map(({ notice, message }, index) => (
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
                <Heading as="h3" id={`account-notice-${notice.id}`} size="sm" color="fg" mb={1}>
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
                data-notice-dismiss=""
                aria-describedby={`account-notice-${notice.id}`}
                onClick={() => {
                  focusAfterDismiss.current = index;
                  void dismiss(notice.id);
                }}
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
