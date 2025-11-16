'use client';

/**
 * Login Page - Email/Password + Social Login
 * Story 2.2: Social Login (Google and GitHub)
 * Story 2.3: Login with Email/Password
 *
 * Implements user login with:
 * - Email/password authentication
 * - Google and GitHub OAuth
 * - Supabase Auth integration
 * - Chakra UI styling (Trust Blue theme)
 * - Full accessibility (WCAG 2.1 Level A)
 * - Responsive design (mobile-first)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  InputGroup,
  InputRightElement,
  IconButton,
  useToast,
  Divider,
  AbsoluteCenter,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { FaGoogle, FaGithub } from 'react-icons/fa';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Handle email/password login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Basic validation
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email address is invalid';
    }
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Specific error handling for different scenarios
        let errorDescription = 'Network error - please try again';

        if (error.message === 'Invalid login credentials') {
          errorDescription = 'Invalid email or password';
        } else if (
          error.message === 'Email not confirmed' ||
          error.message.includes('not verified') ||
          error.message.includes('confirm your email')
        ) {
          errorDescription = 'Please verify your email first';
        }

        toast({
          title: 'Login failed',
          description: errorDescription,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsLoading(false);
        return;
      }

      // Success - redirect to dashboard
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      router.push('/');
      router.refresh();
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

  // Handle social login (Google and GitHub)
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({
          title: 'Authentication failed',
          description:
            error.message === 'Authorization cancelled'
              ? 'You cancelled the authorization'
              : 'Network error - please try again',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch {
      toast({
        title: 'Unexpected error',
        description: 'Network error - please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

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
            Welcome back
          </Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            Sign in to continue managing your finances
          </Text>
        </VStack>

        {/* Social Login Buttons */}
        <VStack spacing={3} align="stretch">
          <Button
            size="lg"
            variant="outline"
            leftIcon={<FaGoogle />}
            onClick={() => handleSocialLogin('google')}
            borderColor="gray.300"
            _hover={{ bg: 'gray.50', borderColor: '#2b6cb0' }}
            minH="44px"
            fontWeight="medium"
            aria-label="Continue with Google"
          >
            Continue with Google
          </Button>
          <Button
            size="lg"
            variant="outline"
            leftIcon={<FaGithub />}
            onClick={() => handleSocialLogin('github')}
            borderColor="gray.300"
            _hover={{ bg: 'gray.50', borderColor: '#2b6cb0' }}
            minH="44px"
            fontWeight="medium"
            aria-label="Continue with GitHub"
          >
            Continue with GitHub
          </Button>
        </VStack>

        {/* Divider with "or" text */}
        <Box position="relative" padding="4">
          <Divider />
          <AbsoluteCenter bg="gray.50" px="4">
            <Text fontSize="sm" color="gray.500" fontWeight="medium">
              or continue with email
            </Text>
          </AbsoluteCenter>
        </Box>

        {/* Login Form */}
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
                  borderColor: '#2b6cb0',
                  boxShadow: '0 0 0 1px #2b6cb0',
                }}
              />
              {errors.email && (
                <FormErrorMessage id="email-error" color="red.500" fontSize="sm">
                  {errors.email}
                </FormErrorMessage>
              )}
            </FormControl>

            {/* Password Field */}
            <FormControl isInvalid={!!errors.password} isRequired>
              <FormLabel htmlFor="password" fontSize="sm" fontWeight="medium">
                Password
              </FormLabel>
              <InputGroup size="lg">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="Password"
                  aria-required="true"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'password-error' : undefined
                  }
                  autoComplete="current-password"
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
              {errors.password && (
                <FormErrorMessage
                  id="password-error"
                  color="red.500"
                  fontSize="sm"
                >
                  {errors.password}
                </FormErrorMessage>
              )}
            </FormControl>

            {/* Forgot Password Link */}
            <Box display="flex" justifyContent="flex-end" alignItems="center">
              <Link
                href="/forgot-password"
                style={{ color: '#2b6cb0', fontSize: '14px', fontWeight: '600' }}
              >
                Forgot password?
              </Link>
            </Box>

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
              loadingText="Signing in..."
              isDisabled={!email || !password}
              minH="44px"
              w="full"
              fontWeight="semibold"
              aria-label="Sign in"
            >
              Sign in
            </Button>
          </VStack>
        </Box>

        {/* Signup Link */}
        <Text textAlign="center" fontSize="sm" color="gray.600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#2b6cb0', fontWeight: '600' }}>
            Sign up
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}
