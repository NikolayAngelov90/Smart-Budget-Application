'use client';

/**
 * Home Page
 * Story 2.5: Session Management and Auto-Logout
 * Story 2.6: First-Time User Onboarding
 *
 * Main landing page that serves both authenticated and unauthenticated users.
 * Implements inactivity detection, auto-logout, and first-time user onboarding.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Box,
  useToast,
} from '@chakra-ui/react';
import { createClient } from '@/lib/supabase/client';
import { useInactivityLogout } from '@/lib/hooks/useInactivityLogout';
import { InactivityWarningModal } from '@/components/common/InactivityWarningModal';
import { OnboardingModal } from '@/components/common/OnboardingModal';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const supabase = createClient();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Inactivity hook (always call hooks unconditionally)
  const { showWarning, timeRemaining, extendSession, logout } = useInactivityLogout();

  // Check authentication status and onboarding status
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      setLoading(false);

      // Check if user needs onboarding
      if (currentUser) {
        const onboardingCompleted =
          currentUser.user_metadata?.onboarding_completed === true;
        setShowOnboarding(!onboardingCompleted);
      }
    };

    checkUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Show inactivity message if redirected from logout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const message = params.get('message');

      if (message === 'inactivity') {
        toast({
          title: 'Logged out',
          description: 'You were logged out due to inactivity',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });

        // Clear the message param from URL
        window.history.replaceState({}, '', '/login');
      }
    }
  }, [toast]);

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);

    // Update user metadata
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    if (error) {
      console.error('Failed to update onboarding status:', error);
    } else {
      toast({
        title: 'Welcome aboard!',
        description: 'You\'re all set to start tracking your finances.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Handle onboarding skip
  const handleOnboardingSkip = async () => {
    setShowOnboarding(false);

    // Still mark as completed even if skipped
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });
  };

  // Authenticated user view
  if (!loading && user) {
    return (
      <>
        <Container maxW="container.xl" py={8}>
          {/* Header with logout button */}
          <HStack justify="space-between" mb={12}>
            <Heading as="h2" size="lg" color="gray.800">
              Smart Budget Application
            </Heading>
            <Button
              onClick={logout}
              variant="outline"
              borderColor="gray.300"
              _hover={{ bg: 'gray.50', borderColor: '#2b6cb0' }}
              fontWeight="medium"
            >
              Logout
            </Button>
          </HStack>

          {/* Main content */}
          <VStack spacing={8} align="center" py={12}>
            <Heading as="h1" size="2xl" textAlign="center" color="trustBlue.500">
              Welcome, {user.email}!
            </Heading>
            <Text fontSize="xl" textAlign="center" color="gray.600">
              Your AI-powered personal finance tracker
            </Text>
            <Box
              p={8}
              bg="blue.50"
              borderRadius="lg"
              border="1px"
              borderColor="blue.200"
              maxW="2xl"
            >
              <VStack spacing={4}>
                <Heading as="h3" size="md" color="gray.800">
                  Session Active
                </Heading>
                <Text fontSize="sm" textAlign="center" color="gray.700">
                  Your session is protected with automatic logout after 30 minutes of
                  inactivity. You&apos;ll receive a warning 5 minutes before logout.
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Dashboard and transaction features coming in Epic 5!
                </Text>
              </VStack>
            </Box>
          </VStack>
        </Container>

        {/* Inactivity Warning Modal */}
        <InactivityWarningModal
          isOpen={showWarning}
          timeRemaining={timeRemaining}
          onExtendSession={extendSession}
        />

        {/* Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </>
    );
  }

  // Unauthenticated user view (loading or not logged in)
  return (
    <Container maxW="container.xl" py={20}>
      <VStack spacing={8} align="center">
        <Heading as="h1" size="2xl" textAlign="center" color="trustBlue.500">
          Smart Budget Application
        </Heading>
        <Text fontSize="xl" textAlign="center" color="gray.600">
          AI-powered personal finance tracker with smart insights
        </Text>
        {loading ? (
          <Text color="gray.500">Loading...</Text>
        ) : (
          <HStack spacing={4}>
            <Button as={Link} href="/login" colorScheme="trustBlue" size="lg">
              Login
            </Button>
            <Button
              as={Link}
              href="/signup"
              variant="outline"
              borderColor="trustBlue.500"
              color="trustBlue.500"
              size="lg"
            >
              Sign Up
            </Button>
          </HStack>
        )}
      </VStack>
    </Container>
  );
}
