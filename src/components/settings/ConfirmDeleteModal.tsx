'use client';

/**
 * Confirm Delete Modal Component
 * Story 8.3: Settings Page and Account Management
 *
 * AC-8.3.8: Account deletion confirmation modal
 * - Warning message
 * - Password input for verification
 * - Cancel and Confirm buttons
 */

import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  Input,
  FormControl,
  FormLabel,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { WarningIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  isDeleting: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: ConfirmDeleteModalProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!password) {
      setError(t('passwordRequired'));
      return;
    }

    setError('');

    try {
      await onConfirm(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('accountDeleteFailed'));
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="red.600" display="flex" alignItems="center" gap={2}>
          <WarningIcon />
          {t('deleteAccountPermanently')}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="error" variant="subtle">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <AlertTitle>{t('cannotBeUndone')}</AlertTitle>
                <AlertDescription>
                  {t('allDataDeleted')}
                </AlertDescription>
              </VStack>
            </Alert>

            <Text color="gray.600">
              {t('exportBeforeDelete')}
            </Text>

            <FormControl isRequired>
              <FormLabel>{t('enterPasswordToConfirm')}</FormLabel>
              <Input
                type="password"
                placeholder={t('yourPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isDisabled={isDeleting}
                autoFocus
              />
            </FormControl>

            {error && (
              <Alert status="error">
                <AlertIcon />
                {error}
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={handleClose} isDisabled={isDeleting}>
            {tCommon('cancel')}
          </Button>
          <Button
            colorScheme="red"
            onClick={handleConfirm}
            isLoading={isDeleting}
            loadingText={t('deletingAccount')}
          >
            {t('confirmDeletion')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
