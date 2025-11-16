/**
 * Inactivity Warning Modal
 * Story 2.5: Session Management and Auto-Logout
 *
 * Displays a warning modal before auto-logout due to inactivity.
 * Shows countdown timer and allows user to extend session.
 */

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  Icon,
} from '@chakra-ui/react';
import { WarningIcon } from '@chakra-ui/icons';

interface InactivityWarningModalProps {
  isOpen: boolean;
  timeRemaining: number; // seconds
  onExtendSession: () => void;
}

export function InactivityWarningModal({
  isOpen,
  timeRemaining,
  onExtendSession,
}: InactivityWarningModalProps) {
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onExtendSession}
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent mx={4}>
        <ModalHeader>
          <VStack spacing={3} align="center">
            <Icon as={WarningIcon} boxSize={12} color="orange.500" />
            <Text fontSize="xl" fontWeight="bold">
              Are you still there?
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody>
          <VStack spacing={4} textAlign="center">
            <Text color="gray.700">
              You&apos;ll be logged out in <strong>{formatTime(timeRemaining)}</strong> due
              to inactivity.
            </Text>
            <Text fontSize="sm" color="gray.600">
              Your session will expire to protect your financial data on shared devices.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center">
          <Button
            bg="#2b6cb0"
            color="white"
            _hover={{ bg: '#2c5282' }}
            _active={{ bg: '#2c5282' }}
            size="lg"
            minH="44px"
            px={8}
            onClick={onExtendSession}
            autoFocus
          >
            Stay logged in
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
