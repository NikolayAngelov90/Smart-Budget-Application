'use client';

/**
 * Email Verification Waiting Page
 * Story 2.1: User Registration with Email/Password
 *
 * Displays after successful signup, prompting user to check their email
 */

import Link from 'next/link';
import { Box, Container, Heading, Text, VStack, Button } from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';

export default function VerifyEmailPage() {
  return (
    <Container maxW="md" py={{ base: '12', md: '24' }} px={{ base: '4', md: '8' }}>
      <VStack spacing={8} align="stretch" textAlign="center">
        <Box>
          <CheckCircleIcon boxSize={16} color="green.500" mb={4} />
          <Heading as="h1" size="xl" color="gray.900" mb={4}>
            Check your email
          </Heading>
          <Text color="gray.600" fontSize="md" mb={2}>
            We've sent you a verification email. Click the link in the email to activate your account.
          </Text>
          <Text color="gray.500" fontSize="sm">
            The email should arrive within 15 minutes. Don't forget to check your spam folder!
          </Text>
        </Box>

        <Box
          bg="blue.50"
          p={6}
          borderRadius="md"
          border="1px"
          borderColor="blue.200"
        >
          <Text fontSize="sm" color="gray.700">
            <strong>What's next?</strong>
            <br />
            1. Check your inbox for a verification email
            <br />
            2. Click the verification link
            <br />
            3. Sign in to start using Smart Budget
          </Text>
        </Box>

        <Button
          as={Link}
          href="/login"
          size="lg"
          bg="#2b6cb0"
          color="white"
          _hover={{ bg: '#2c5282' }}
          minH="44px"
        >
          Go to Login
        </Button>

        <Text fontSize="sm" color="gray.500">
          Didn't receive an email?{' '}
          <Link href="/signup" style={{ color: '#2b6cb0', fontWeight: '600' }}>
            Try signing up again
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}
