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
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setError('');

    try {
      await onConfirm(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
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
          Delete Account Permanently
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="error" variant="subtle">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <AlertTitle>This action cannot be undone!</AlertTitle>
                <AlertDescription>
                  All your data including transactions, categories, and insights will be
                  permanently deleted.
                </AlertDescription>
              </VStack>
            </Alert>

            <Text color="gray.600">
              Before proceeding, please make sure you have exported your data using the
              &quot;Export Transactions (CSV)&quot; button above.
            </Text>

            <FormControl isRequired>
              <FormLabel>Enter your password to confirm</FormLabel>
              <Input
                type="password"
                placeholder="Your password"
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
            Cancel
          </Button>
          <Button
            colorScheme="red"
            onClick={handleConfirm}
            isLoading={isDeleting}
            loadingText="Deleting account..."
          >
            Confirm Deletion
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
