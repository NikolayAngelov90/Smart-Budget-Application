'use client';

/**
 * Signup Page - User Registration with Email/Password
 * Story 2.1: User Registration with Email/Password
 *
 * Implements email/password registration with:
 * - React Hook Form + Zod validation
 * - Password strength meter
 * - Supabase Auth integration
 * - Chakra UI styling (Trust Blue theme)
 * - Full accessibility (WCAG 2.1 Level A)
 * - Responsive design (mobile-first)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Progress,
  InputGroup,
  InputRightElement,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { createClient } from '@/lib/supabase/client';

// Zod validation schema
const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least 1 number')
      .regex(
        /[^A-Za-z0-9]/,
        'Password must contain at least 1 special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

// Password strength calculation (simple version without zxcvbn)
function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2)
    return { score: 33, label: 'Weak', color: 'red.500' };
  if (score === 3 || score === 4)
    return { score: 66, label: 'Medium', color: 'orange.400' };
  return { score: 100, label: 'Strong', color: 'green.500' };
}

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: 'gray.200',
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');

  // Update password strength as user types
  useEffect(() => {
    if (password) {
      const strength = calculatePasswordStrength(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, label: '', color: 'gray.200' });
    }
  }, [password]);

  // Handle form submission
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Handle specific Supabase errors
        if (error.message.includes('already registered')) {
          toast({
            title: 'Email already registered',
            description: 'This email is already in use. Please try logging in instead.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        } else if (error.message.includes('rate limit')) {
          toast({
            title: 'Too many requests',
            description: 'Please wait a moment before trying again.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
        } else {
          toast({
            title: 'Registration failed',
            description: 'Network error - please try again',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
        setIsLoading(false);
        return;
      }

      // Success case
      toast({
        title: 'Account created!',
        description: 'Check your email to verify your account.',
        status: 'success',
        duration: 7000,
        isClosable: true,
      });

      // Redirect to email verification waiting page
      router.push('/auth/verify-email');
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
            Create your account
          </Heading>
          <Text color="gray.600" fontSize={{ base: 'sm', md: 'md' }}>
            Start managing your finances with confidence
          </Text>
        </VStack>

        {/* Signup Form */}
        <Box
          as="form"
          onSubmit={handleSubmit(onSubmit)}
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
                {...register('email')}
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
                  {errors.email.message}
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
                  placeholder="Create a strong password"
                  {...register('password')}
                  aria-label="Password"
                  aria-required="true"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : 'password-strength'}
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

              {/* Password Strength Meter */}
              {password && (
                <Box mt={2} id="password-strength">
                  <Progress
                    value={passwordStrength.score}
                    size="sm"
                    colorScheme={
                      passwordStrength.label === 'Weak'
                        ? 'red'
                        : passwordStrength.label === 'Medium'
                        ? 'orange'
                        : 'green'
                    }
                    borderRadius="full"
                    aria-label={`Password strength: ${passwordStrength.label}`}
                  />
                  <Text fontSize="xs" color={passwordStrength.color} mt={1}>
                    Password strength: {passwordStrength.label}
                  </Text>
                </Box>
              )}

              {errors.password && (
                <FormErrorMessage id="password-error" color="red.500" fontSize="sm">
                  {errors.password.message}
                </FormErrorMessage>
              )}

              <Text fontSize="xs" color="gray.500" mt={1}>
                Min 8 characters, 1 uppercase, 1 number, 1 special character
              </Text>
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
                  placeholder="Re-enter your password"
                  {...register('confirmPassword')}
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
                <FormErrorMessage id="confirm-password-error" color="red.500" fontSize="sm">
                  {errors.confirmPassword.message}
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
              isLoading={isLoading}
              loadingText="Creating account..."
              isDisabled={!isValid || isLoading}
              minH="44px"
              w="full"
              fontWeight="semibold"
              aria-label="Create account"
            >
              Create account
            </Button>
          </VStack>
        </Box>

        {/* Login Link */}
        <Text textAlign="center" fontSize="sm" color="gray.600">
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#2b6cb0', fontWeight: '600' }}>
            Sign in
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}
