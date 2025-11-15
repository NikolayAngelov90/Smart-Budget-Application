'use client';

import { Box, Text } from '@chakra-ui/react';

export function MobileNav() {
  return (
    <Box
      display={{ base: 'block', md: 'none' }}
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="white"
      borderTop="1px"
      borderColor="gray.200"
      p={3}
    >
      <Text fontSize="sm" textAlign="center" color="gray.500">
        Mobile navigation placeholder
      </Text>
    </Box>
  );
}
