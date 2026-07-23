'use client';

import { Box, Center, Text, VStack } from '@chakra-ui/react';

interface EmptyStateProps {
  /** An emoji or icon element shown in a soft accent circle. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action (usually a Button). */
  cta?: React.ReactNode;
}

/**
 * A guiding empty state — never a dead end. Reused across the Quiet Ledger
 * redesign (Epic 16): a title that says what will appear here and a clear next
 * action, rather than a bare "No data".
 */
export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <Box
      bg="surface"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="border"
      px={6}
      py={{ base: 12, md: 16 }}
    >
      <Center>
        <VStack spacing={3} maxW="380px" textAlign="center">
          {icon && (
            <Center
              aria-hidden
              w="56px"
              h="56px"
              borderRadius="full"
              bg="accent.subtle"
              fontSize="2xl"
              mb={1}
            >
              {icon}
            </Center>
          )}
          <Text fontFamily="heading" fontSize="lg" fontWeight={600} color="fg">
            {title}
          </Text>
          {description && (
            <Text fontSize="sm" color="fg.muted" lineHeight={1.5}>
              {description}
            </Text>
          )}
          {cta && <Box pt={2}>{cta}</Box>}
        </VStack>
      </Center>
    </Box>
  );
}
