'use client';

/**
 * Home Page
 * Story 2.5: Session Management and Auto-Logout
 * Story 2.6: First-Time User Onboarding
 * Story 11.1: Streamlined Onboarding Flow (Phase 2)
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

  // Story 11.1: Handle onboarding completion with profile data
  const handleOnboardingComplete = async (data: { displayName?: string; currencyFormat: string }) => {
    setShowOnboarding(false);

    // Save display name, currency, and onboarding_completed to user profile (dual storage consistency)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: data.displayName || undefined,
          preferences: { currency_format: data.currencyFormat, onboarding_completed: true },
        }),
      });

      if (!response.ok) {
        console.error('Failed to save profile preferences');
      }
    } catch (err) {
      console.error('Failed to save profile preferences:', err);
    }

    // Update user metadata to mark onboarding as complete
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    if (error) {
      console.error('Failed to update onboarding status:', error);
    }

    // Story 11.1 AC#6: Initialize progressive disclosure state (ADR-022)
    await initializeFeatureState();

    toast({
      title: 'Welcome aboard!',
      description: 'You\'re all set to start tracking your finances.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });

    router.push('/dashboard');
  };

  // Handle onboarding skip
  const handleOnboardingSkip = async () => {
    setShowOnboarding(false);

    // Still mark as completed even if skipped (dual storage: auth metadata + DB preferences)
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { onboarding_completed: true } }),
      });
    } catch {
      // Non-blocking — auth metadata is the primary check
    }

    // Story 11.1 AC#6: Initialize progressive disclosure state even on skip
    await initializeFeatureState();

    // Redirect to dashboard after skipping onboarding
    router.push('/dashboard');
  };

  // Story 11.1 AC#6: Create user_feature_state record for progressive disclosure
  const initializeFeatureState = async () => {
    if (!user) return;
    try {
      const { error: featureStateError } = await supabase
        .from('user_feature_state')
        .upsert({
          user_id: user.id,
          transactions_count: 0,
          days_active: 0,
          features_unlocked: [],
        }, { onConflict: 'user_id' });

      if (featureStateError) {
        console.error('Failed to initialize feature state:', featureStateError);
      }
    } catch (err) {
      console.error('Failed to initialize feature state:', err);
    }
  };

  // Extract default display name from OAuth metadata
  const defaultDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';

  // Show onboarding modal if user is authenticated but hasn't completed onboarding
  if (!loading && user && showOnboarding) {
    return (
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        defaultDisplayName={defaultDisplayName}
      />
    );
  }

  // Authenticated users with completed onboarding are redirected to dashboard
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
