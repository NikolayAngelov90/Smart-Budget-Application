'use client';

/**
 * Reset Password Page
 * Story 2.4: Password Reset Flow
 *
 * Implements password reset with:
 * - Token validation from URL
 * - New password input with validation (8+ chars, complexity)
 * - Password confirmation field
 * - Supabase password update
 * - Chakra UI styling (Trust Blue theme)
 * - Full accessibility (WCAG 2.1 Level A)
 * - Responsive design (mobile-first)
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Heading,
  Input,
  Text,
  VStack,
  InputGroup,
  InputRightElement,
  IconButton,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { createClient } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenError, setTokenError] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  // Verify session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      // If no session or error, the reset link may be invalid or expired
      if (error || !session) {
        // Check if there's an error in the URL (Supabase adds error params)
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam || errorDescription) {
          setTokenError(true);
        }
      }
    };

    checkSession();
  }, [searchParams, supabase.auth]);

  const validatePassword = (pwd: string): string | undefined => {
    if (!pwd) return 'Password is required';
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validation
    const newErrors: { password?: string; confirmPassword?: string } = {};

    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        // Handle specific errors
        let errorDescription = 'Network error - please try again';

        if (
          error.message.includes('expired') ||
          error.message.includes('invalid') ||
          error.message.includes('not found')
        ) {
          errorDescription = 'Reset link expired or invalid. Please request a new one.';
          setTokenError(true);
        }

        toast({
          title: 'Password reset failed',
          description: errorDescription,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsLoading(false);
        return;
      }

      // Success
      toast({
        title: 'Password updated!',
        description: 'Password updated successfully! Please log in.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Sign out to clear session and redirect to login
      await supabase.auth.signOut();

      // Redirect to login page
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    } catch {
      toast({
        title: 'Unexpected error',
        description: 'Network error - please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };

  // Show error state if token is invalid or expired
  if (tokenError) {
    return (
      <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <VStack spacing={2} textAlign="center">
            <Heading
              as="h1"
              size={{ base: 'xl', md: '2xl' }}
              color="gray.900"
              fontWeight="bold"
            >
              Reset link expired
            </Heading>
            <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
              This password reset link is invalid or has expired
            </Text>
          </VStack>

          {/* Error Alert */}
          <Alert
            status="error"
            variant="subtle"
            borderRadius="lg"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            py={6}
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertDescription mt={4} maxWidth="sm">
              Password reset links expire after 1 hour for security reasons. Please request
              a new reset link.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <VStack spacing={3}>
            <Button
              as={Link}
              href="/forgot-password"
              size="lg"
              bg="#2b6cb0"
              color="white"
              _hover={{ bg: '#2c5282' }}
              minH="44px"
              w="full"
              fontWeight="semibold"
            >
              Request new reset link
            </Button>
            <Button
              as={Link}
              href="/login"
              size="lg"
              variant="outline"
              borderColor="gray.300"
              _hover={{ bg: 'gray.50' }}
              minH="44px"
              w="full"
              fontWeight="medium"
            >
              Back to login
            </Button>
          </VStack>
        </VStack>
      </Container>
    );
  }

  // Show password reset form
  return (
    <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <VStack spacing={2} textAlign="center">
          <Heading
            as="h1"
            size={{ base: 'xl', md: '2xl' }}
            color="gray.900"
            fontWeight="bold"
          >
            Reset your password
          </Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            Enter your new password below
          </Text>
        </VStack>

        {/* Reset Form */}
        <Box
          as="form"
          onSubmit={handleSubmit}
          bg="white"
          p={{ base: '6', md: '8' }}
          borderRadius="lg"
          boxShadow="lg"
          border="1px"
          borderColor="gray.200"
        >
          <VStack spacing={5} align="stretch">
            {/* New Password Field */}
            <FormControl isInvalid={!!errors.password} isRequired>
              <FormLabel htmlFor="password" fontSize="sm" fontWeight="medium">
                New password
              </FormLabel>
              <InputGroup size="lg">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="New password"
                  aria-required="true"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'password-error' : 'password-helper'
                  }
                  autoComplete="new-password"
                  _focus={{
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowPassword(!showPassword)}
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                  />
                </InputRightElement>
              </InputGroup>
              {errors.password ? (
                <FormErrorMessage id="password-error" color="red.500" fontSize="sm">
                  {errors.password}
                </FormErrorMessage>
              ) : (
                <FormHelperText id="password-helper" fontSize="xs" color="gray.500">
                  At least 8 characters with uppercase, lowercase, and number
                </FormHelperText>
              )}
            </FormControl>

            {/* Confirm Password Field */}
            <FormControl isInvalid={!!errors.confirmPassword} isRequired>
              <FormLabel htmlFor="confirmPassword" fontSize="sm" fontWeight="medium">
                Confirm password
              </FormLabel>
              <InputGroup size="lg">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-label="Confirm password"
                  aria-required="true"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword ? 'confirm-password-error' : undefined
                  }
                  autoComplete="new-password"
                  _focus={{
                    borderColor: '#2b6cb0',
                    boxShadow: '0 0 0 1px #2b6cb0',
                  }}
                />
                <InputRightElement>
                  <IconButton
                    aria-label={
                      showConfirmPassword ? 'Hide password' : 'Show password'
                    }
                    icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                  />
                </InputRightElement>
              </InputGroup>
              {errors.confirmPassword && (
                <FormErrorMessage
                  id="confirm-password-error"
                  color="red.500"
                  fontSize="sm"
                >
                  {errors.confirmPassword}
                </FormErrorMessage>
              )}
            </FormControl>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              bg="#2b6cb0"
              color="white"
              _hover={{ bg: '#2c5282' }}
              _active={{ bg: '#2c5282' }}
              _disabled={{ bg: 'gray.300', cursor: 'not-allowed' }}
              isLoading={isLoading}
              loadingText="Updating password..."
              isDisabled={!password || !confirmPassword}
              minH="44px"
              w="full"
              fontWeight="semibold"
              aria-label="Reset password"
            >
              Reset password
            </Button>
          </VStack>
        </Box>

        {/* Back to Login Link */}
        <Text textAlign="center" fontSize="sm" color="gray.600">
          Remember your password?{' '}
          <Link href="/login" style={{ color: '#2b6cb0', fontWeight: '600' }}>
            Back to login
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
          <VStack spacing={8} align="stretch">
            <VStack spacing={2} textAlign="center">
              <Heading
                as="h1"
                size={{ base: 'xl', md: '2xl' }}
                color="gray.900"
                fontWeight="bold"
              >
                Loading...
              </Heading>
            </VStack>
          </VStack>
        </Container>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
