'use client';

/**
 * Danger zone — GDPR account deletion. Story 16.8 gives it its own row at the
 * end of the Settings index instead of burying it inside Privacy & Security.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Button, Card, CardBody, Text, VStack, useDisclosure, useToast } from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import { ConfirmDeleteModal } from '@/components/settings/ConfirmDeleteModal';
import {
  deletionFailureMessage,
  refusalChangedData,
  type SettingsTranslate,
} from '@/components/settings/deletionRefusalMessage';

export function DangerZoneSection() {
  const t = useTranslations('settings');
  const toast = useToast();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);

  // The provider-bound mutate: the global one is inert under the localStorage
  // cache provider.
  const { mutate } = useSWRConfig();
  const translate: SettingsTranslate = t;

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      let response: Response;
      try {
        response = await fetch('/api/user/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation_password: password }),
        });
      } catch (networkError) {
        // Offline or reset: the browser's own English ("Failed to fetch") must
        // not reach the dialog.
        console.error('Error deleting account (no response):', networkError);
        throw new Error(t('accountDeleteFailed'));
      }

      // A non-JSON body (e.g. a platform error page) must not surface as a raw
      // SyntaxError message in the dialog.
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // A refusal that moved the household or shared objects left the cached
        // household/category/budget/goal data stale: revalidate every key.
        if (refusalChangedData(data)) void mutate(() => true);
        throw new Error(deletionFailureMessage(translate, response.status, data));
      }

      // Only a body that SAYS the account was deleted is a success; a 2xx that
      // cannot be read is not proof of anything.
      if ((data as { data?: { success?: unknown } } | null)?.data?.success !== true) {
        throw new Error(t('accountDeleteFailed'));
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
