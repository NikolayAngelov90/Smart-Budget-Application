'use client';

import { Box, Flex, VStack, Link as ChakraLink, Icon, HStack, Text, IconButton, Tooltip } from '@chakra-ui/react';
import { ViewIcon, EditIcon, AtSignIcon, InfoIcon, SettingsIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HouseholdIcon } from '@/components/icons/HouseholdIcon';

// Primary destinations, then Settings pinned to the foot as a utility — the rail
// itself encodes what matters most vs. what's housekeeping.
const primaryNav = [
  { key: 'dashboard' as const, href: '/dashboard', icon: ViewIcon },
  { key: 'transactions' as const, href: '/transactions', icon: EditIcon },
  { key: 'insights' as const, href: '/insights', icon: InfoIcon },
  { key: 'categories' as const, href: '/categories', icon: AtSignIcon },
  { key: 'goals' as const, href: '/goals', icon: StarIcon },
  { key: 'household' as const, href: '/household', icon: HouseholdIcon },
];
const footerNav = [{ key: 'settings' as const, href: '/settings', icon: SettingsIcon }];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  const renderItem = (item: { key: string; href: string; icon: React.ElementType }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const name = t(item.key);
    return (
      <Tooltip
        key={item.href}
        label={isCollapsed ? name : ''}
        placement="right"
        isDisabled={!isCollapsed}
        hasArrow
      >
        <ChakraLink
          as={Link}
          href={item.href}
          _hover={{ textDecoration: 'none' }}
          aria-current={isActive ? 'page' : undefined}
        >
          <HStack
            spacing={isCollapsed ? 0 : 3}
            h="44px"
            px={isCollapsed ? 0 : 3}
            borderRadius="lg"
            bg={isActive ? 'accent.subtle' : 'transparent'}
            color={isActive ? 'accent' : 'fg.muted'}
            fontWeight={isActive ? 'semibold' : 'medium'}
            fontSize="sm"
            _hover={{
              bg: isActive ? 'accent.subtle' : 'surface.hover',
              color: isActive ? 'accent' : 'fg',
            }}
            _focusVisible={{ boxShadow: 'focus', outline: 'none' }}
            transition="background 0.16s ease, color 0.16s ease"
            tabIndex={0}
            justifyContent={isCollapsed ? 'center' : 'flex-start'}
          >
            <Icon as={item.icon} boxSize={5} />
            {!isCollapsed && <Text>{name}</Text>}
          </HStack>
        </ChakraLink>
      </Tooltip>
    );
  };

  return (
    <Flex
      as="nav"
      direction="column"
      w={isCollapsed ? '68px' : '244px'}
      bg="surface"
      h="full"
      p={3}
      borderRightWidth="1px"
      borderColor="border"
      aria-label="Main navigation"
      transition="width 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
      position="relative"
    >
      {/* Collapse toggle */}
      {onToggleCollapse && (
        <Box position="absolute" top={4} right="-13px" zIndex={1}>
          <Tooltip label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')} placement="right" hasArrow>
            <IconButton
              aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              icon={isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              size="xs"
              onClick={onToggleCollapse}
              bg="surface"
              color="fg.muted"
              borderWidth="1px"
              borderColor="border"
              borderRadius="full"
              boxShadow="sm"
              _hover={{ bg: 'surface.hover', color: 'accent' }}
            />
          </Tooltip>
        </Box>
      )}

      <VStack align="stretch" spacing={1} mt={onToggleCollapse ? 6 : 0}>
        {primaryNav.map(renderItem)}
      </VStack>

      {/* Settings pinned to the foot */}
      <VStack align="stretch" spacing={1} mt="auto" pt={2}>
        <Box borderTopWidth="1px" borderColor="border" mb={1} mx={isCollapsed ? 1 : 2} />
        {footerNav.map(renderItem)}
      </VStack>
    </Flex>
  );
}
