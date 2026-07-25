'use client';

/**
 * MoreSheet — mobile "More" overflow.
 *
 * The bottom tab bar only fits a few primary destinations + the centre Add, so
 * the secondary ones (Categories, Goals, Household, Settings) used to be
 * reachable on mobile ONLY via avatar -> Settings -> "Manage" list (3-4 taps).
 * This thumb-reachable sheet — opened from a "More" tab — surfaces them in one
 * tap, and the management rows carry an inline "+" so adding a category/goal is
 * two taps from anywhere (the centre Add stays a one-tap new-transaction).
 *
 * Matches the AccountSheet bottom-sheet pattern (Quiet Ledger).
 */

import {
  Box,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerOverlay,
  Flex,
  Icon,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { AddIcon, SettingsIcon, AtSignIcon, StarIcon } from '@chakra-ui/icons';
import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HouseholdIcon } from '@/components/icons/HouseholdIcon';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ManageDest {
  href: string;
  label: string;
  icon: ComponentType;
  /** When set, the row shows an inline "+" that deep-links to the page's add flow. */
  add?: { href: string; label: string };
}

export function MoreSheet({ isOpen, onClose }: MoreSheetProps) {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const destinations: ManageDest[] = [
    {
      href: '/categories',
      label: t('categories'),
      icon: AtSignIcon,
      add: { href: '/categories?new=1', label: t('addCategory') },
    },
    {
      href: '/goals',
      label: t('goals'),
      icon: StarIcon,
      add: { href: '/goals?new=1', label: t('addGoal') },
    },
    { href: '/household', label: t('household'), icon: HouseholdIcon },
    { href: '/settings', label: t('settings'), icon: SettingsIcon },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="bottom">
      <DrawerOverlay />
      <DrawerContent borderTopRadius="26px" pb="env(safe-area-inset-bottom)" bg="surface">
        {/* Drag-handle affordance */}
        <Flex justify="center" pt={2} pb={1}>
          <Box w="36px" h="4px" borderRadius="full" bg="border.strong" />
        </Flex>
        <DrawerBody px={4} pb={4}>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.subtle"
            textTransform="uppercase"
            letterSpacing="wide"
            px={2}
            pt={1}
            pb={2}
          >
            {t('manage')}
          </Text>
          <VStack align="stretch" spacing={0}>
            {destinations.map((dest) => {
              const isActive =
                pathname === dest.href || pathname.startsWith(dest.href + '/');
              return (
                <Flex
                  key={dest.href}
                  align="center"
                  borderRadius="lg"
                  _hover={{ bg: 'surface.hover' }}
                >
                  {/* Row body → navigate to the management page */}
                  <Flex
                    as={Link}
                    href={dest.href}
                    onClick={onClose}
                    flex={1}
                    minW={0}
                    align="center"
                    gap={3}
                    py={3}
                    px={2}
                    minH="52px"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      as={dest.icon}
                      color={isActive ? 'accent' : 'fg.muted'}
                      boxSize={5}
                    />
                    <Text
                      noOfLines={1}
                      color={isActive ? 'accent' : 'fg'}
                      fontWeight={isActive ? 'semibold' : 'medium'}
                    >
                      {dest.label}
                    </Text>
                  </Flex>

                  {/* Inline quick-add → deep-link that opens the page's add modal */}
                  {dest.add && (
                    <IconButton
                      as={Link}
                      href={dest.add.href}
                      onClick={onClose}
                      aria-label={dest.add.label}
                      icon={<AddIcon boxSize={3} />}
                      variant="ghost"
                      color="accent"
                      _hover={{ bg: 'accent.subtle' }}
                      minW="44px"
                      minH="44px"
                      mr={1}
                      flexShrink={0}
                    />
                  )}
                </Flex>
              );
            })}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
