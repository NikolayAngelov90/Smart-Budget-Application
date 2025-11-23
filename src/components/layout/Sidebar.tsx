'use client';

import { Box, VStack, Link as ChakraLink, Icon, HStack, Text } from '@chakra-ui/react';
import { ViewIcon, EditIcon, AtSignIcon } from '@chakra-ui/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    name: 'Dashboard',
    href: '/',
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
            >
              <HStack
                spacing={3}
                p={3}
                borderRadius="md"
                bg={isActive ? 'blue.50' : 'transparent'}
                color={isActive ? 'blue.600' : 'gray.700'}
                fontWeight={isActive ? 'semibold' : 'medium'}
                _hover={{
                  bg: isActive ? 'blue.50' : 'gray.100',
                }}
                transition="all 0.2s"
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
