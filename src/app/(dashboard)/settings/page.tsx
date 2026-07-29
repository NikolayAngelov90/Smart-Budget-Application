'use client';

/**
 * Settings index — Story 16.8
 *
 * Was a single 1214-line page of ~12 stacked cards, where feature content (the
 * values plan, achievements) sat above the user's own account info and the two
 * halves of "how the app contacts you" lived in different cards. It is now a
 * short index; each group owns a route and renders through `SettingsSubPage`.
 *
 * The old "Manage" card linking to Categories/Goals is deliberately gone —
 * both are in the desktop sidebar and the mobile More sheet, so it was a
 * duplicate path into the same screens.
 */

import { Card, CardBody, Container, Flex, Heading, Icon, Text, VStack } from '@chakra-ui/react';
import {
  ChevronRightIcon,
  AtSignIcon,
  BellIcon,
  DownloadIcon,
  InfoOutlineIcon,
  LockIcon,
  MoonIcon,
  SettingsIcon,
  StarIcon,
} from '@chakra-ui/icons';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DangerZoneSection } from '@/components/settings/sections/DangerZoneSection';

interface SettingsGroup {
  href: string;
  /** i18n keys (settings namespace) */
  labelKey: string;
  descriptionKey: string;
  icon: ComponentType;
}

/**
 * Order is deliberate: the user's own account first, then how the app LOOKS,
 * then how it BEHAVES, then what it SENDS, then their data, then security, then
 * legal. Destructive actions sit apart at the very end.
 */
const GROUPS: SettingsGroup[] = [
  {
    href: '/settings/account',
    labelKey: 'accountInformation',
    descriptionKey: 'accountSummary',
    icon: AtSignIcon,
  },
  {
    href: '/settings/appearance',
    labelKey: 'appearanceHeading',
    descriptionKey: 'appearanceSummary',
    icon: MoonIcon,
  },
  {
    href: '/settings/preferences',
    labelKey: 'preferences',
    descriptionKey: 'preferencesSummary',
    icon: SettingsIcon,
  },
  {
    href: '/settings/notifications',
    labelKey: 'notificationsHeading',
    descriptionKey: 'notificationsSummary',
    icon: BellIcon,
  },
  {
    href: '/settings/personalization',
    labelKey: 'personalizationHeading',
    descriptionKey: 'personalizationSummary',
    icon: StarIcon,
  },
  {
    href: '/settings/data',
    labelKey: 'exportData',
    descriptionKey: 'dataSummary',
    icon: DownloadIcon,
  },
  {
    href: '/settings/security',
    labelKey: 'privacyAndSecurity',
    descriptionKey: 'securitySummary',
    icon: LockIcon,
  },
  {
    href: '/settings/about',
    labelKey: 'aboutHeading',
    descriptionKey: 'aboutSummary',
    icon: InfoOutlineIcon,
  },
];

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <AppLayout>
      <Container maxW="container.md" py={{ base: 4, md: 8 }}>
        <VStack spacing={6} align="stretch">
          <Heading as="h1" size="xl" color="fg" fontFamily="heading" letterSpacing="tight">
            {t('title')}
          </Heading>

          <Card>
            <CardBody p={0}>
              <VStack align="stretch" spacing={0}>
                {GROUPS.map((group, index) => (
                  <Flex
                    key={group.href}
                    as={NextLink}
                    href={group.href}
                    align="center"
                    gap={4}
                    px={4}
                    py={3}
                    minH="64px"
                    borderTopWidth={index === 0 ? 0 : '1px'}
                    borderColor="border"
                    _hover={{ bg: 'surface.hover' }}
                    _focusVisible={{
                      outline: '2px solid',
                      outlineColor: 'accent',
                      outlineOffset: '-2px',
                    }}
                  >
                    <Icon as={group.icon} boxSize={5} color="accent" flexShrink={0} />
                    <VStack align="start" spacing={0} flex={1} minW={0}>
                      <Text fontWeight="semibold" color="fg" noOfLines={1}>
                        {t(group.labelKey)}
                      </Text>
                      <Text fontSize="sm" color="fg.muted" noOfLines={1}>
                        {t(group.descriptionKey)}
                      </Text>
                    </VStack>
                    <Icon as={ChevronRightIcon} boxSize={5} color="fg.subtle" flexShrink={0} />
                  </Flex>
                ))}
              </VStack>
            </CardBody>
          </Card>

          <DangerZoneSection />
        </VStack>
      </Container>
    </AppLayout>
  );
}
