'use client';

/**
 * Shared shell for a Settings sub-page — Story 16.8
 *
 * Every group (`/settings/account`, `/settings/notifications`, …) renders
 * through this so the back affordance, title and spacing are identical, and a
 * new group is a few lines rather than another copy of the page chrome.
 */

import { Box, Container, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';

interface SettingsSubPageProps {
  /** i18n key (settings namespace) for the group title. */
  titleKey: string;
  /** Optional one-line description under the title. */
  descriptionKey?: string;
  children: React.ReactNode;
}

export function SettingsSubPage({ titleKey, descriptionKey, children }: SettingsSubPageProps) {
  const t = useTranslations('settings');

  return (
    <AppLayout>
      <Container maxW="container.md" py={{ base: 4, md: 8 }}>
        <VStack spacing={6} align="stretch">
          <Box>
            <HStack
              as={NextLink}
              href="/settings"
              spacing={1}
              color="fg.muted"
              fontSize="sm"
              fontWeight="medium"
              mb={3}
              minH="44px"
              display="inline-flex"
              alignItems="center"
              _hover={{ color: 'accent' }}
              // Matches the sidebar's focus treatment; without it this link
              // fell back to the UA ring, which is near-invisible on the dark
              // canvas — and this is the primary way out of a sub-page.
              _focusVisible={{ boxShadow: 'focus', outline: 'none', borderRadius: 'md' }}
              aria-label={t('backToSettings')}
            >
              <ChevronLeftIcon boxSize={5} />
              <Text>{t('title')}</Text>
            </HStack>

            <Heading as="h1" size="lg" color="fg" fontFamily="heading" letterSpacing="tight">
              {t(titleKey)}
            </Heading>
            {descriptionKey && (
              <Text color="fg.muted" mt={1}>
                {t(descriptionKey)}
              </Text>
            )}
          </Box>

          {children}
        </VStack>
      </Container>
    </AppLayout>
  );
}
