/**
 * First Transaction Prompt Component
 * Story 11.1: Streamlined Onboarding Flow
 *
 * Displayed on the dashboard when user has 0 transactions.
 * Encourages the user to add their first transaction with a prominent CTA.
 */

'use client';

import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  Icon,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';

interface FirstTransactionPromptProps {
  onAddTransaction: () => void;
}

export function FirstTransactionPrompt({ onAddTransaction }: FirstTransactionPromptProps) {
  const t = useTranslations('dashboard');

  return (
    <Box
      bg="white"
      border="2px dashed"
      borderColor="trustBlue.200"
      borderRadius="xl"
      p={{ base: 8, md: 12 }}
      textAlign="center"
    >
      <VStack spacing={4}>
        <Box
          bg="trustBlue.50"
          borderRadius="full"
          p={4}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={AddIcon} boxSize={8} color="trustBlue.500" />
        </Box>

        <Heading as="h3" size="md" color="gray.800">
          {t('firstTransactionTitle')}
        </Heading>

        <Text color="gray.600" fontSize="md" maxW="sm">
          {t('firstTransactionDescription')}
        </Text>

        <Button
          bg="#2b6cb0"
          color="white"
          _hover={{ bg: '#2c5282' }}
          _active={{ bg: '#2c5282' }}
          size="lg"
          minH="44px"
          px={8}
          leftIcon={<AddIcon />}
          onClick={onAddTransaction}
          aria-label={t('firstTransactionCta')}
        >
          {t('firstTransactionCta')}
        </Button>
      </VStack>
    </Box>
  );
}
