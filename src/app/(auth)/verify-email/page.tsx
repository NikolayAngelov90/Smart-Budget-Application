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
          <CheckCircleIcon boxSize={16} color="income" mb={4} />
          <Heading as="h1" size="xl" color="fg" mb={4}>
            Check your email
          </Heading>
          <Text color="fg.muted" fontSize="md" mb={2}>
            We've sent you a verification email. Click the link in the email to activate your account.
          </Text>
          <Text color="fg.subtle" fontSize="sm">
            The email should arrive within 15 minutes. Don't forget to check your spam folder!
          </Text>
        </Box>

        <Box
          bg="accent.subtle"
          p={6}
          borderRadius="md"
          border="1px"
          borderColor="accent"
        >
          <Text fontSize="sm" color="fg">
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
          bg="accent"
          color="fg.onAccent"
          _hover={{ bg: 'accent.emphasis' }}
          minH="44px"
        >
          Go to Login
        </Button>

        <Text fontSize="sm" color="fg.subtle">
          Didn't receive an email?{' '}
          <Link href="/signup" style={{ color: 'var(--chakra-colors-accent)', fontWeight: '600' }}>
            Try signing up again
          </Link>
        </Text>
      </VStack>
    </Container>
  );
}
