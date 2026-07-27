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
      bg="surface"
      border="2px dashed"
      borderColor="accent"
      borderRadius="xl"
      p={{ base: 8, md: 12 }}
      textAlign="center"
    >
      <VStack spacing={4}>
        <Box
          bg="accent.subtle"
          borderRadius="full"
          p={4}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={AddIcon} boxSize={8} color="accent" />
        </Box>

        <Heading as="h3" size="md" color="fg">
          {t('firstTransactionTitle')}
        </Heading>

        <Text color="fg.muted" fontSize="md" maxW="sm">
          {t('firstTransactionDescription')}
        </Text>

        <Button
          bg="accent"
          color="fg.onAccent"
          _hover={{ bg: 'accent.emphasis' }}
          _active={{ bg: 'accent.emphasis' }}
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
