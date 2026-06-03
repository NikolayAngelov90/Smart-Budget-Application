'use client';

/**
 * AccountSheet — Story UX-1 (Mobile Shell)
 *
 * Bottom-sheet for account actions, opened from the header avatar. Replaces the
 * hard-to-reach top-right dropdown with a thumb-reachable sheet (EXPERIENCE.md).
 */

import {
  Avatar,
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react';
import { SettingsIcon } from '@chakra-ui/icons';
import { MdLogout } from 'react-icons/md';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface AccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  displayName: string;
  avatarUrl?: string;
  onLogout: () => void;
}

export function AccountSheet({
  isOpen,
  onClose,
  email,
  displayName,
  avatarUrl,
  onLogout,
}: AccountSheetProps) {
  const t = useTranslations('header');

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="bottom">
      <DrawerOverlay />
      <DrawerContent borderTopRadius="16px" pb="env(safe-area-inset-bottom)">
        {/* Drag-handle affordance */}
        <Flex justify="center" pt={2} pb={1}>
          <Box w="36px" h="4px" borderRadius="full" bg="gray.300" />
        </Flex>
        <DrawerBody px={4} pb={4}>
          <VStack align="stretch" spacing={1}>
            {/* Identity */}
            <Flex align="center" gap={3} py={3}>
              <Avatar size="md" name={displayName} src={avatarUrl} bg="trustBlue.500" color="white" />
              <Box minW={0}>
                <Text fontWeight="semibold" noOfLines={1}>{displayName}</Text>
                <Text fontSize="sm" color="gray.500" noOfLines={1}>{email}</Text>
              </Box>
            </Flex>

            <Box borderTopWidth="1px" borderColor="gray.200" my={1} />

            {/* Account / Settings */}
            <Flex
              as={Link}
              href="/settings"
              onClick={onClose}
              align="center"
              gap={3}
              py={3}
              px={2}
              borderRadius="md"
              minH="48px"
              _hover={{ bg: 'gray.50' }}
            >
              <Icon as={SettingsIcon} color="gray.600" boxSize={5} />
              <Text>{t('accountSettings')}</Text>
            </Flex>

            {/* Sign out */}
            <Flex
              as="button"
              onClick={() => { onClose(); onLogout(); }}
              align="center"
              gap={3}
              py={3}
              px={2}
              borderRadius="md"
              minH="48px"
              w="full"
              textAlign="left"
              color="red.600"
              _hover={{ bg: 'red.50' }}
            >
              <Icon as={MdLogout} boxSize={5} />
              <Text>{t('logout')}</Text>
            </Flex>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
