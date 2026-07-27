'use client';

/**
 * Forgot Password Page
 * Story 2.4: Password Reset Flow
 *
 * Implements password reset request with:
 * - Email input field with validation
 * - Supabase password reset email trigger
 * - Chakra UI styling (Trust Blue theme)
 * - Full accessibility (WCAG 2.1 Level A)
 * - Responsive design (mobile-first)
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Heading,
  Input,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Email validation
    const newErrors: { email?: string } = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email address is invalid';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: 'Request failed',
          description: 'Network error - please try again',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsLoading(false);
        return;
      }

      // Success - always show success message for security
      // (Don't reveal if email exists in system)
      setEmailSent(true);
      toast({
        title: 'Reset link sent',
        description: 'Password reset link sent to your email',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch {
      toast({
        title: 'Unexpected error',
        description: 'Network error - please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state after email is sent
  if (emailSent) {
    return (
      <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <VStack spacing={2} textAlign="center">
            <Heading
              as="h1"
              size={{ base: 'xl', md: '2xl' }}
              color="fg"
              fontWeight="bold"
            >
              Check your email
            </Heading>
            <Text color="fg.muted" fontSize={{ base: 'sm', md: 'md' }}>
              We&apos;ve sent a password reset link to <strong>{email}</strong>
            </Text>
          </VStack>

          {/* Instructions */}
          <Box
            bg="surface"
            p={{ base: '6', md: '8' }}
            borderRadius="lg"
            boxShadow="lg"
            border="1px"
            borderColor="border"
          >
            <VStack spacing={4} align="stretch">
              <Text color="fg" fontSize="sm">
                Click the link in the email to reset your password. The link will expire in
                1 hour for security reasons.
              </Text>
              <Text color="fg.muted" fontSize="sm">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <Button
                  variant="link"
                  color="accent"
                  fontSize="sm"
                  fontWeight="600"
                  onClick={() => setEmailSent(false)}
                >
                  try again
                </Button>
                .
              </Text>
            </VStack>
          </Box>

          {/* Back to Login Link */}
          <Text textAlign="center" fontSize="sm" color="fg.muted">
            Remember your password?{' '}
            <Link href="/login" style={{ color: 'var(--chakra-colors-accent)', fontWeight: '600' }}>
              Back to login
            </Link>
          </Text>
        </VStack>
      </Container>
    );
  }

  // Show password reset request form
  return (
    <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <VStack spacing={2} textAlign="center">
          <Heading
            as="h1"
            size={{ base: 'xl', md: '2xl' }}
            color="fg"
            fontWeight="bold"
          >
            Forgot password?
          </Heading>
          <Text color="fg.muted" fontSize={{ base: 'sm', md: 'md' }}>
            Enter your email and we&apos;ll send you a reset link
          </Text>
        </VStack>

        {/* Reset Form */}
        <Box
          as="form"
          onSubmit={handleSubmit}
          bg="surface"
          p={{ base: '6', md: '8' }}
          borderRadius="lg"
          boxShadow="lg"
          border="1px"
          borderColor="border"
        >
          <VStack spacing={5} align="stretch">
            {/* Email Field */}
            <FormControl isInvalid={!!errors.email} isRequired>
              <FormLabel htmlFor="email" fontSize="sm" fontWeight="medium">
                Email address
              </FormLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                autoComplete="email"
                _focus={{
                  borderColor: 'accent',
                  boxShadow: '0 0 0 1px var(--chakra-colors-accent)',
                }}
              />
              {errors.email && (
                <FormErrorMessage id="email-error" color="expense" fontSize="sm">
                  {errors.email}
                </FormErrorMessage>
              )}
            </FormControl>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              bg="accent"
              color="white"
              _hover={{ bg: '#2c5282' }}
              _active={{ bg: '#2c5282' }}
              _disabled={{ bg: 'border.strong', cursor: 'not-allowed' }}
              isLoading={isLoading}
              loadingText="Sending link..."
              isDisabled={!email}
              minH="44px"
              w="full"
              fontWeight="semibold"
              aria-label="Send reset link"
            >
              Send reset link
            </Button>
          </VStack>
        </Box>

        {/* Back to Login Link */}
        <Text textAlign="center" fontSize="sm" color="fg.muted">
          Remember your password?{' '}
          <Link href="/login" style={{ color: 'var(--chakra-colors-accent)', fontWeight: '600' }}>
            Back to login
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}
