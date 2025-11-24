'use client';

import { Box, VStack, Link as ChakraLink, Icon, HStack, Text } from '@chakra-ui/react';
import { ViewIcon, EditIcon, AtSignIcon, InfoIcon, SettingsIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: ViewIcon,
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: EditIcon,
  },
  {
    name: 'Categories',
    href: '/categories',
    icon: AtSignIcon,
  },
  {
    name: 'Insights',
    href: '/insights',
    icon: InfoIcon,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      w="250px"
      bg="gray.50"
      h="full"
      p={4}
      borderRight="1px"
      borderColor="gray.200"
      aria-label="Main navigation"
    >
      <VStack align="stretch" spacing={1}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <ChakraLink
              key={item.href}
              as={Link}
              href={item.href}
              _hover={{ textDecoration: 'none' }}
              aria-current={isActive ? 'page' : undefined}
            >
              <HStack
                spacing={3}
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
              >
                <Icon as={item.icon} boxSize={5} />
                <Text>{item.name}</Text>
              </HStack>
            </ChakraLink>
          );
        })}
      </VStack>
    </Box>
  );
}
