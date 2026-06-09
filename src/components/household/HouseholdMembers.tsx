'use client';

/**
 * HouseholdMembers — Story 13.11
 *
 * Lists household members (email, role). An admin can remove any member except themselves
 * (behind a confirm). Removal immediately revokes the member's access to shared data.
 */

import { useRef, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Badge,
  Divider,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHouseholdMembers } from '@/lib/hooks/useHouseholdMembers';
import type { HouseholdMemberListEntry } from '@/types/database.types';

export function HouseholdMembers({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('household');
  const toast = useToast();
  const { members, isLoading, mutate } = useHouseholdMembers();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<HouseholdMemberListEntry | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  if (isLoading || members.length === 0) return null;

  const askRemove = (member: HouseholdMemberListEntry) => {
    setTarget(member);
    onOpen();
  };

  const confirmRemove = async () => {
    if (!target) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/households/members/${target.user_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('removeFailed'));
      await mutate();
      toast({ title: t('removed'), status: 'success', duration: 3000, isClosable: true });
      onClose();
      setTarget(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t('removeFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Box>
      <Divider my={2} />
      <Heading as="h3" size="sm" color="gray.700" mb={2}>
        {t('membersHeading')}
      </Heading>

      <VStack align="stretch" spacing={2}>
        {members.map((m) => (
          <HStack key={m.user_id} justify="space-between" align="center">
            <HStack spacing={2} minW={0}>
              <Text fontSize="sm" color="gray.800" isTruncated>
                {m.isSelf ? t('you') : m.email}
              </Text>
              <Badge colorScheme={m.role === 'admin' ? 'blue' : 'gray'} borderRadius="full" px={2} fontSize="10px">
                {m.role === 'admin' ? t('roleAdmin') : t('roleMember')}
              </Badge>
            </HStack>
            {isAdmin && !m.isSelf && (
              <Button size="xs" variant="ghost" colorScheme="red" flexShrink={0} onClick={() => askRemove(m)}>
                {t('remove')}
              </Button>
            )}
          </HStack>
        ))}
      </VStack>

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {t('removeConfirmTitle')}
            </AlertDialogHeader>
            <AlertDialogBody>{t('removeConfirmBody', { email: target?.email ?? '' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} isDisabled={isRemoving}>
                {t('cancel')}
              </Button>
              <Button colorScheme="red" onClick={confirmRemove} ml={3} isLoading={isRemoving} loadingText={t('removeCta')}>
                {t('removeCta')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
