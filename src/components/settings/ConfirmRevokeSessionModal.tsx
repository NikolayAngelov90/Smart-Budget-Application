'use client';

/**
 * Confirm Revoke Session Modal Component
 * Story 9-6: Complete Device Session Management
 *
 * AC-9.6.6: Confirmation modal required before revoking session
 */

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
  VStack,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { WarningIcon } from '@chakra-ui/icons';
import type { ConfirmRevokeSessionModalProps } from '@/types/session.types';

export function ConfirmRevokeSessionModal({
  isOpen,
  onClose,
  onConfirm,
  deviceName,
  isLoading = false,
}: ConfirmRevokeSessionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="orange.600" display="flex" alignItems="center" gap={2}>
          <WarningIcon />
          Revoke Device Access
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="warning" variant="subtle">
              <AlertIcon />
              This will immediately log out this device.
            </Alert>

            <Text>
              Are you sure you want to revoke access for{' '}
              <Text as="span" fontWeight="bold">
                {deviceName}
              </Text>
              ? The user will need to log in again on that device.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            colorScheme="orange"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Revoking..."
          >
            Revoke Access
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
