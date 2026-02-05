'use client';

/**
 * Active Devices Section Component
 * Story 9-6: Complete Device Session Management
 *
 * AC-9.6.2: Settings page displays active device sessions
 * AC-9.6.3: User can edit device name inline
 * AC-9.6.4: Display last active timestamp
 * AC-9.6.5: User can revoke device session
 * AC-9.6.7: Cannot revoke current session
 * AC-9.6.8: Real-time updates via Supabase Realtime
 */

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  IconButton,
  Skeleton,
  Alert,
  AlertIcon,
  useToast,
  useDisclosure,
  Tooltip,
  Box,
  Badge,
} from '@chakra-ui/react';
import { EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { FaMobileAlt, FaTabletAlt, FaDesktop } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import useSWR, { mutate } from 'swr';
import { createClient } from '@/lib/supabase/client';
import { ConfirmRevokeSessionModal } from './ConfirmRevokeSessionModal';
import type { DeviceSession } from '@/types/session.types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.data;
};

export function ActiveDevicesSection() {
  const toast = useToast();

  // Fetch sessions with SWR
  const { data: sessions, error, isLoading } = useSWR<DeviceSession[]>(
    '/api/user/sessions',
    fetcher
  );

  // State for editing device name
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // State for revoke modal
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [sessionToRevoke, setSessionToRevoke] = useState<DeviceSession | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Current session token (from localStorage analytics session ID)
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);

  // Ref for tracking component mount
  const isMounted = useRef(true);

  // Get current session token on mount
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      setCurrentSessionToken(localStorage.getItem('analytics_session_id'));
    }
  }, []);

  // AC-9.6.8: Set up Supabase Realtime subscription
  useEffect(() => {
    isMounted.current = true;
    const supabase = createClient();

    const channel = supabase
      .channel('user_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions',
        },
        () => {
          // Revalidate sessions on any change
          if (isMounted.current) {
            mutate('/api/user/sessions');
          }
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // AC-9.6.4: Update timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update relative timestamps
      mutate('/api/user/sessions');
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Get device icon based on device type
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return FaMobileAlt;
      case 'tablet':
        return FaTabletAlt;
      default:
        return FaDesktop;
    }
  };

  // AC-9.6.3: Start editing device name
  const handleStartEdit = (session: DeviceSession) => {
    setEditingSessionId(session.id);
    setEditedName(session.device_name);
  };

  // AC-9.6.3: Cancel editing
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditedName('');
  };

  // AC-9.6.3: Save device name (optimistic UI)
  const handleSaveName = async (sessionId: string) => {
    if (!editedName.trim()) {
      toast({
        title: 'Device name cannot be empty',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);

    try {
      // Optimistic update
      const optimisticSessions = sessions?.map((s) =>
        s.id === sessionId ? { ...s, device_name: editedName.trim() } : s
      );
      mutate('/api/user/sessions', optimisticSessions, false);

      const response = await fetch(`/api/user/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: editedName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update device name');
      }

      // Revalidate
      await mutate('/api/user/sessions');

      toast({
        title: 'Device name updated',
        status: 'success',
        duration: 3000,
      });

      handleCancelEdit();
    } catch {
      // Revert optimistic update
      await mutate('/api/user/sessions');

      toast({
        title: 'Failed to update device name',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // AC-9.6.5: Open revoke modal
  const handleOpenRevokeModal = (session: DeviceSession) => {
    setSessionToRevoke(session);
    onOpen();
  };

  // AC-9.6.5: Revoke session (optimistic UI)
  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;

    setIsRevoking(true);

    try {
      // Optimistic update - remove session from list
      const optimisticSessions = sessions?.filter((s) => s.id !== sessionToRevoke.id);
      mutate('/api/user/sessions', optimisticSessions, false);

      const response = await fetch(`/api/user/sessions/${sessionToRevoke.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      // Revalidate
      await mutate('/api/user/sessions');

      toast({
        title: 'Device access revoked',
        description: `${sessionToRevoke.device_name} has been logged out.`,
        status: 'success',
        duration: 3000,
      });

      onClose();
      setSessionToRevoke(null);
    } catch {
      // Revert optimistic update
      await mutate('/api/user/sessions');

      toast({
        title: 'Failed to revoke access',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsRevoking(false);
    }
  };

  // Check if session is current session (simplified check using session_token comparison)
  // Note: In a real implementation, we'd compare the actual session token
  // For now, we mark the most recently active session as "current"
  const isCurrentSession = (session: DeviceSession) => {
    // If we have a current session token, compare it
    if (currentSessionToken && session.session_token === currentSessionToken) {
      return true;
    }
    // Fallback: assume most recently active is current (first in sorted list)
    return sessions && sessions[0]?.id === session.id;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Active Devices</Heading>
            <Skeleton height="80px" />
            <Skeleton height="80px" />
          </VStack>
        </CardBody>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Active Devices</Heading>
            <Alert status="error">
              <AlertIcon />
              Failed to load active devices. Please try again.
            </Alert>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  // Empty state
  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Active Devices</Heading>
            <Text color="gray.600">No active sessions found.</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Active Devices</Heading>
            <Text color="gray.600" fontSize="sm">
              Manage devices logged into your account. You can rename devices or revoke access
              to log them out remotely.
            </Text>

            <VStack align="stretch" spacing={3} divider={<Box borderBottom="1px" borderColor="gray.200" />}>
              {sessions.map((session) => {
                const isCurrent = isCurrentSession(session);
                const DeviceIcon = getDeviceIcon(session.device_type);
                const isEditing = editingSessionId === session.id;

                return (
                  <HStack key={session.id} spacing={4} py={2} align="start">
                    {/* Device Icon */}
                    <Box
                      p={2}
                      bg={isCurrent ? 'blue.50' : 'gray.50'}
                      borderRadius="md"
                      color={isCurrent ? 'blue.500' : 'gray.500'}
                    >
                      <Box as={DeviceIcon} boxSize={5} />
                    </Box>

                    {/* Device Info */}
                    <VStack align="start" flex={1} spacing={1}>
                      <HStack>
                        {isEditing ? (
                          <HStack>
                            <Input
                              size="sm"
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              maxW="200px"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName(session.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <IconButton
                              aria-label="Save"
                              icon={<CheckIcon />}
                              size="sm"
                              colorScheme="green"
                              onClick={() => handleSaveName(session.id)}
                              isLoading={isSaving}
                            />
                            <IconButton
                              aria-label="Cancel"
                              icon={<CloseIcon />}
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                            />
                          </HStack>
                        ) : (
                          <>
                            <Text fontWeight="medium">{session.device_name}</Text>
                            {isCurrent && (
                              <Badge colorScheme="blue" fontSize="xs">
                                Current Device
                              </Badge>
                            )}
                            <IconButton
                              aria-label="Edit device name"
                              icon={<EditIcon />}
                              size="xs"
                              variant="ghost"
                              onClick={() => handleStartEdit(session)}
                            />
                          </>
                        )}
                      </HStack>

                      <HStack spacing={2} color="gray.500" fontSize="sm">
                        <Text>{session.browser || 'Unknown browser'}</Text>
                        <Text>•</Text>
                        {/* AC-9.6.4: Last active timestamp */}
                        <Text>
                          Last active:{' '}
                          {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                        </Text>
                      </HStack>
                    </VStack>

                    {/* Revoke Button */}
                    <Tooltip
                      label={isCurrent ? 'You cannot revoke your current session' : 'Revoke access'}
                      hasArrow
                    >
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        isDisabled={isCurrent}
                        onClick={() => handleOpenRevokeModal(session)}
                      >
                        Revoke Access
                      </Button>
                    </Tooltip>
                  </HStack>
                );
              })}
            </VStack>
          </VStack>
        </CardBody>
      </Card>

      {/* AC-9.6.6: Confirmation Modal */}
      <ConfirmRevokeSessionModal
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setSessionToRevoke(null);
        }}
        onConfirm={handleConfirmRevoke}
        deviceName={sessionToRevoke?.device_name || ''}
        isLoading={isRevoking}
      />
    </>
  );
}
