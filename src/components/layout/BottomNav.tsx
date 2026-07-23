'use client';

/**
 * BottomNav Component
 * Story 10-8: Mobile-Optimized Touch UI
 *
 * AC-10.8.1: Persistent bottom tab bar visible only on mobile (<768px).
 * AC-10.8.2: Center "Add" tab is visually elevated; opens transaction modal.
 * AC-10.8.5: All touch targets are minimum 48×48px.
 */

import { Box, Flex, VStack, Text, IconButton } from '@chakra-ui/react';
import { ViewIcon, EditIcon, AddIcon, InfoIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { HouseholdIcon } from '@/components/icons/HouseholdIcon';

type NavKey = 'dashboard' | 'transactions' | 'household' | 'insights';

interface NavTab {
  key: NavKey;
  href: string;
  icon: ComponentType;
}

// 4 labelled tabs + the centre "Add" (2 on each side). Settings is reached from the
// header account menu (avatar → Account Settings), not the bottom bar.
const NAV_TABS: NavTab[] = [
  { key: 'dashboard', href: '/dashboard', icon: ViewIcon },
  { key: 'transactions', href: '/transactions', icon: EditIcon },
  // "Add" center tab is rendered separately (between index 1 and 2)
  { key: 'household', href: '/household', icon: HouseholdIcon },
  { key: 'insights', href: '/insights', icon: InfoIcon },
];

interface BottomNavProps {
  /** Called when the center "Add" tab is tapped — opens the transaction modal. */
  onAddClick: () => void;
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  return (
    <Box
      as="nav"
      aria-label="Mobile navigation"
      display={{ base: 'flex', md: 'none' }}
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={100}
      // Story UX-1: translucent blurred bar for a native iOS feel; solid-surface
      // fallback where backdrop-filter is unsupported (DESIGN.md).
      bg="rgba(255,255,255,0.85)"
      sx={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        '@supports not ((backdrop-filter: blur(16px)) or (-webkit-backdrop-filter: blur(16px)))': {
          backgroundColor: 'surface',
        },
      }}
      borderTopWidth="1px"
      borderTopColor="border"
      boxShadow="0 -8px 24px -12px rgba(26,28,26,0.12)"
      // iOS safe areas. In standalone (Home Screen) mode the bottom inset is ~34px,
      // which lifts the icons noticeably; reclaim most of it while keeping clearance
      // above the home-indicator pill. Browser mode (inset 0) keeps a small 4px gap.
      // (landscape notch left/right unchanged)
      paddingBottom="max(calc(env(safe-area-inset-bottom) - 16px), 4px)"
      paddingLeft="env(safe-area-inset-left)"
      paddingRight="env(safe-area-inset-right)"
    >
      <Flex
        w="full"
        h="56px"
        align="center"
        justify="space-around"
        px={1}
      >
        {/* Left two tabs */}
        {NAV_TABS.slice(0, 2).map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Box
              key={tab.href}
              as={Link}
              href={tab.href}
              flex={1}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minH="48px"
              minW="48px"
              color={isActive ? 'accent' : 'fg.subtle'}
              _hover={{ color: 'accent' }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(tab.key)}
            >
              <VStack spacing={1}>
                <Box as={tab.icon} boxSize={5} />
                <Text fontSize="2xs" fontWeight={isActive ? 'semibold' : 'medium'} lineHeight={1} letterSpacing="tight">
                  {t(tab.key)}
                </Text>
              </VStack>
            </Box>
          );
        })}

        {/* Center "Add" elevated tab */}
        <Flex
          flex={1}
          direction="column"
          align="center"
          justify="center"
          minW="48px"
          // Pull the button upward above the nav bar
          mt="-24px"
        >
          <IconButton
            aria-label="Add transaction"
            icon={<AddIcon boxSize={4} />}
            onClick={onAddClick}
            // A soft evergreen squircle — the app's signature action, distinct
            // from a generic round FAB.
            borderRadius="18px"
            w="54px"
            h="54px"
            minW="54px"
            minH="54px"
            bg="accent"
            color="white"
            boxShadow="accent"
            _hover={{ bg: 'accent.emphasis', transform: 'translateY(-1px) scale(1.04)' }}
            _active={{ bg: 'evergreen.700', transform: 'scale(0.96)' }}
            transition="all 0.16s cubic-bezier(0.4, 0, 0.2, 1)"
          />
          <Text fontSize="2xs" color="accent" fontWeight="semibold" mt="3px" lineHeight={1} letterSpacing="tight">
            {t('add')}
          </Text>
        </Flex>

        {/* Right two tabs */}
        {NAV_TABS.slice(2).map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Box
              key={tab.href}
              as={Link}
              href={tab.href}
              flex={1}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minH="48px"
              minW="48px"
              color={isActive ? 'accent' : 'fg.subtle'}
              _hover={{ color: 'accent' }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(tab.key)}
            >
              <VStack spacing={1}>
                <Box as={tab.icon} boxSize={5} />
                <Text fontSize="2xs" fontWeight={isActive ? 'semibold' : 'medium'} lineHeight={1} letterSpacing="tight">
                  {t(tab.key)}
                </Text>
              </VStack>
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
}
