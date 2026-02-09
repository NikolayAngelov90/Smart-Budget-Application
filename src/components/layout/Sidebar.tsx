'use client';

import { Box, VStack, Link as ChakraLink, Icon, HStack, Text, IconButton, Tooltip } from '@chakra-ui/react';
import { ViewIcon, EditIcon, AtSignIcon, InfoIcon, SettingsIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const navItemKeys = [
  { key: 'dashboard' as const, href: '/dashboard', icon: ViewIcon },
  { key: 'transactions' as const, href: '/transactions', icon: EditIcon },
  { key: 'categories' as const, href: '/categories', icon: AtSignIcon },
  { key: 'insights' as const, href: '/insights', icon: InfoIcon },
  { key: 'settings' as const, href: '/settings', icon: SettingsIcon },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  return (
    <Box
      as="nav"
      w={isCollapsed ? '60px' : '250px'}
      bg="gray.50"
      h="full"
      p={isCollapsed ? 2 : 4}
      borderRight="1px"
      borderColor="gray.200"
      aria-label="Main navigation"
      transition="width 0.3s ease, padding 0.3s ease"
      position="relative"
    >
      {/* Toggle Button */}
      {onToggleCollapse && (
        <Box position="absolute" top={2} right={-3} zIndex={1}>
          <Tooltip label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')} placement="right">
            <IconButton
              aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              icon={isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              size="sm"
              onClick={onToggleCollapse}
              colorScheme="trustBlue"
              variant="solid"
              borderRadius="full"
              boxShadow="md"
            />
          </Tooltip>
        </Box>
      )}

      <VStack align="stretch" spacing={1} mt={onToggleCollapse ? 8 : 0}>
        {navItemKeys.map((item) => {
          const isActive = pathname === item.href;
          const name = t(item.key);
          return (
            <Tooltip
              key={item.href}
              label={isCollapsed ? name : ''}
              placement="right"
              isDisabled={!isCollapsed}
            >
              <ChakraLink
                as={Link}
                href={item.href}
                _hover={{ textDecoration: 'none' }}
                aria-current={isActive ? 'page' : undefined}
              >
                <HStack
                  spacing={isCollapsed ? 0 : 3}
                  p={3}
                  borderRadius="md"
                  bg={isActive ? 'blue.50' : 'transparent'}
                  color={isActive ? 'trustBlue.500' : 'gray.700'}
                  fontWeight={isActive ? 'semibold' : 'medium'}
                  borderLeft="4px"
                  borderLeftColor={isActive ? 'trustBlue.500' : 'transparent'}
                  _hover={{
                    bg: isActive ? 'blue.50' : 'gray.100',
                    borderLeftColor: isActive ? 'trustBlue.500' : 'gray.300',
                  }}
                  _focus={{
                    outline: '2px solid',
                    outlineColor: 'trustBlue.500',
                    outlineOffset: '2px',
                  }}
                  transition="all 0.2s"
                  tabIndex={0}
                  justifyContent={isCollapsed ? 'center' : 'flex-start'}
                >
                  <Icon as={item.icon} boxSize={5} />
                  {!isCollapsed && <Text>{name}</Text>}
                </HStack>
              </ChakraLink>
            </Tooltip>
          );
        })}
      </VStack>
    </Box>
  );
}
