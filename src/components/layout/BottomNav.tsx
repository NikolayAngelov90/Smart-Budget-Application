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
import { ViewIcon, EditIcon, AddIcon, InfoIcon, SettingsIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { HouseholdIcon } from '@/components/icons/HouseholdIcon';

type NavKey = 'dashboard' | 'transactions' | 'household' | 'insights' | 'settings';

interface NavTab {
  key: NavKey;
  href: string;
  icon: ComponentType;
}

// 5 labelled tabs + the centre "Add" (2 on the left of Add, 3 on the right).
const NAV_TABS: NavTab[] = [
  { key: 'dashboard', href: '/dashboard', icon: ViewIcon },
  { key: 'transactions', href: '/transactions', icon: EditIcon },
  // "Add" center tab is rendered separately (between index 1 and 2)
  { key: 'household', href: '/household', icon: HouseholdIcon },
  { key: 'insights', href: '/insights', icon: InfoIcon },
  { key: 'settings', href: '/settings', icon: SettingsIcon },
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
      // Story UX-1: translucent blurred bar for a native iOS feel; solid-white
      // fallback where backdrop-filter is unsupported (DESIGN.md).
      bg="rgba(255,255,255,0.82)"
      sx={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        '@supports not ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)))': {
          backgroundColor: 'white',
        },
      }}
      borderTopWidth="1px"
      borderTopColor="gray.200"
      boxShadow="0 -2px 12px rgba(0,0,0,0.05)"
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
              color={isActive ? 'trustBlue.500' : 'gray.500'}
              _hover={{ color: 'trustBlue.400' }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(tab.key)}
            >
              <VStack spacing={0.5}>
                <Box as={tab.icon} boxSize={5} />
                <Text fontSize="10px" fontWeight={isActive ? 'semibold' : 'normal'} lineHeight={1}>
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
            icon={<AddIcon />}
            onClick={onAddClick}
            borderRadius="full"
            w="52px"
            h="52px"
            minW="52px"
            minH="52px"
            bg="trustBlue.500"
            color="white"
            boxShadow="0 4px 12px rgba(43, 108, 176, 0.45)"
            _hover={{ bg: 'trustBlue.600', transform: 'scale(1.05)' }}
            _active={{ bg: 'trustBlue.700', transform: 'scale(0.97)' }}
            transition="all 0.15s ease"
          />
          <Text fontSize="10px" color="trustBlue.500" fontWeight="semibold" mt="2px" lineHeight={1}>
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
              color={isActive ? 'trustBlue.500' : 'gray.500'}
              _hover={{ color: 'trustBlue.400' }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(tab.key)}
            >
              <VStack spacing={0.5}>
                <Box as={tab.icon} boxSize={5} />
                <Text fontSize="10px" fontWeight={isActive ? 'semibold' : 'normal'} lineHeight={1}>
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
