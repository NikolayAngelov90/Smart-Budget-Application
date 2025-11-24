'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Avatar,
  Text,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useToast,
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Error logging out',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } else {
      router.push('/login');
    }
  };

  return (
    <Box
      as="header"
      bg="trustBlue.500"
      color="white"
      px={4}
      py={3}
      boxShadow="sm"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Flex align="center" maxW="container.xl" mx="auto" justify="space-between">
        {/* Left side: Hamburger menu (mobile) + Logo */}
        <HStack spacing={3}>
          <IconButton
            aria-label="Open navigation menu"
            icon={<HamburgerIcon />}
            onClick={onMenuClick}
            variant="ghost"
            color="white"
            display={{ base: 'flex', md: 'none' }}
            _hover={{ bg: 'whiteAlpha.200' }}
            _active={{ bg: 'whiteAlpha.300' }}
          />
          <Heading as="h1" size="md" fontWeight="bold">
            Smart Budget
          </Heading>
        </HStack>

        {/* Right side: User info + Logout */}
        {user && (
          <HStack spacing={4}>
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                color="white"
                _hover={{ bg: 'whiteAlpha.200' }}
                _active={{ bg: 'whiteAlpha.300' }}
                leftIcon={<Avatar size="sm" name={user.email || 'User'} bg="whiteAlpha.300" />}
              >
                <Text display={{ base: 'none', sm: 'block' }} fontSize="sm">
                  {user.email?.split('@')[0] || 'User'}
                </Text>
              </MenuButton>
              <MenuList color="gray.800">
                <MenuItem isDisabled>
                  <Text fontSize="sm" fontWeight="medium">
                    {user.email}
                  </Text>
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        )}
      </Flex>
    </Box>
  );
}
