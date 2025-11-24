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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal } from '@/components/common/OnboardingModal';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check authentication status and redirect to dashboard if authenticated
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      setLoading(false);

      // Story 5.1: Redirect authenticated users to dashboard
      if (currentUser) {
        const onboardingCompleted =
          currentUser.user_metadata?.onboarding_completed === true;

        if (!onboardingCompleted) {
          setShowOnboarding(true);
        } else {
          // Redirect to dashboard (default landing page for authenticated users)
          router.push('/dashboard');
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Story 5.1: Redirect to dashboard after onboarding
      router.push('/dashboard');
    }
  };

  // Handle onboarding skip
  const handleOnboardingSkip = async () => {
    setShowOnboarding(false);

    // Still mark as completed even if skipped
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    // Story 5.1: Redirect to dashboard after skipping onboarding
    router.push('/dashboard');
  };

  // Show onboarding modal if user is authenticated but hasn't completed onboarding
  if (!loading && user && showOnboarding) {
    return (
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  // Story 5.1: Authenticated users with completed onboarding are redirected to dashboard
  // This view should not be shown for authenticated users
  if (!loading && user) {
    return null; // Redirecting to dashboard
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
