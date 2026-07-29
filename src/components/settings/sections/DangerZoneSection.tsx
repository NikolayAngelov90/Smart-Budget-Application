'use client';

/**
 * Danger zone — GDPR account deletion. Story 16.8 gives it its own row at the
 * end of the Settings index instead of burying it inside Privacy & Security.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, Text, VStack, useDisclosure, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { ConfirmDeleteModal } from '@/components/settings/ConfirmDeleteModal';

export function DangerZoneSection() {
  const t = useTranslations('settings');
  const toast = useToast();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_password: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.details || 'Failed to delete account');
      }

      // Account deleted successfully
      toast({
        title: t('accountDeleted'),
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Logout and redirect to login page
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error('Error deleting account:', error);
      setIsDeleting(false);
      throw error;
    }
  };
  return (
    <>
      <Card borderColor="danger.fg">
        <CardBody>
          <VStack align="stretch" spacing={3}>
            <Text fontWeight="bold" color="danger.fg">
              {t('dangerZone')}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {t('deleteAccountWarning')}
            </Text>
            <Button leftIcon={<DeleteIcon />} colorScheme="red" variant="outline" onClick={onOpen}>
              {t('deleteAccount')}
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </>
  );
}
