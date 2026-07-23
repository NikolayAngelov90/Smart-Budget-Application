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
  useToast,
  useDisclosure,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { AccountSheet } from './AccountSheet';
import { BrandMark } from './BrandMark';
import type { User } from '@supabase/supabase-js';
import { useUserProfile } from '@/hooks/useUserProfile';

export function Header() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('header');
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

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

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <Box
      as="header"
      // Quiet Ledger: a light header floating over the warm-paper canvas — the
      // full-bleed banking bar is gone. A hairline + translucent blur give it
      // just enough presence without shouting.
      bg="rgba(246,245,242,0.82)"
      color="fg"
      sx={{
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        '@supports not ((backdrop-filter: blur(14px)) or (-webkit-backdrop-filter: blur(14px)))': {
          backgroundColor: 'canvas',
        },
      }}
      // Story UX-1: fill the Dynamic Island / status-bar region and push content below it.
      pt={{ base: 'calc(0.75rem + env(safe-area-inset-top))', md: 3 }}
      pb={3}
      pl="calc(1rem + env(safe-area-inset-left))"
      pr="calc(1rem + env(safe-area-inset-right))"
      borderBottomWidth="1px"
      borderColor="border"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Flex align="center" maxW="container.xl" mx="auto" justify="space-between">
        {/* Left: brand mark (no hamburger — bottom tab bar is the sole mobile nav) */}
        <Heading as="h1" size="md" fontWeight="semibold" m={0}>
          <BrandMark />
        </Heading>

        {/* Right side: Sync Status + account avatar → bottom-sheet */}
        {user && (
          <HStack spacing={{ base: 2, sm: 3 }}>
            <Box display={{ base: 'none', sm: 'flex' }}>
              <SyncStatusIndicator compact />
            </Box>
            <IconButton
              aria-label={t('userMenu')}
              onClick={onOpen}
              variant="ghost"
              borderRadius="full"
              _hover={{ bg: 'surface.hover' }}
              _active={{ bg: 'surface.sunken' }}
              icon={
                <Avatar
                  size="sm"
                  name={displayName}
                  src={profile?.profile_picture_url || undefined}
                  bg="accent"
                  color="white"
                />
              }
            />
          </HStack>
        )}
      </Flex>

      {user && (
        <AccountSheet
          isOpen={isOpen}
          onClose={onClose}
          email={user.email || ''}
          displayName={displayName}
          avatarUrl={profile?.profile_picture_url || undefined}
          onLogout={handleLogout}
        />
      )}
    </Box>
  );
}
