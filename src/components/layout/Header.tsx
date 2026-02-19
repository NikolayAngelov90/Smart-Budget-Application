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
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import type { User } from '@supabase/supabase-js';
import { useUserProfile } from '@/hooks/useUserProfile';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('header');
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  // Shared profile hook — same fetcher as settings page
  const { data: profile } = useUserProfile(!!user);

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
        title: t('logoutError'),
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
            {/* Sync Status Indicator - Story 8.4 AC-8.4.1, AC-8.4.6
                Hidden on mobile (base) to keep header compact alongside BottomNav */}
            <Box display={{ base: 'none', sm: 'flex' }}>
              <SyncStatusIndicator compact />
            </Box>
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
                    name={profile?.display_name || user.email || 'User'}
                    src={profile?.profile_picture_url || undefined}
                    bg="whiteAlpha.300"
                  />
                }
              >
                <Text display={{ base: 'none', sm: 'block' }} fontSize="sm">
                  {profile?.display_name || user.email?.split('@')[0] || 'User'}
                </Text>
              </MenuButton>
              <MenuList color="gray.800">
                <MenuItem isDisabled>
                  <Text fontSize="sm" fontWeight="medium">
                    {user.email}
                  </Text>
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleLogout}>{t('logout')}</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        )}
      </Flex>
    </Box>
  );
}
