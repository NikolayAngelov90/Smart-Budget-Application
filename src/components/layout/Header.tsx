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
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import type { User } from '@supabase/supabase-js';
import useSWR from 'swr';

interface HeaderProps {
  onMenuClick?: () => void;
}

interface UserProfile {
  display_name: string | null;
  profile_picture_url: string | null;
  email: string;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  // Fetch user profile data
  const { data: profile } = useSWR<{ data: UserProfile }>(
    user ? '/api/user/profile' : null,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.json();
    }
  );

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

        {/* Right side: Sync Status + User info + Logout */}
        {user && (
          <HStack spacing={4}>
            {/* Sync Status Indicator - Story 8.4 AC-8.4.1, AC-8.4.6 */}
            <SyncStatusIndicator compact />
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                color="white"
                _hover={{ bg: 'whiteAlpha.200' }}
                _active={{ bg: 'whiteAlpha.300' }}
                leftIcon={
                  <Avatar
                    size="sm"
                    name={profile?.data?.display_name || user.email || 'User'}
                    src={profile?.data?.profile_picture_url || undefined}
                    bg="whiteAlpha.300"
                  />
                }
              >
                <Text display={{ base: 'none', sm: 'block' }} fontSize="sm">
                  {profile?.data?.display_name || user.email?.split('@')[0] || 'User'}
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
