'use client';

import { Box, VStack, Text } from '@chakra-ui/react';

export function Sidebar() {
  return (
    <Box
      as="nav"
      w="250px"
      bg="gray.50"
      h="full"
      p={4}
      borderRight="1px"
      borderColor="gray.200"
    >
      <VStack align="stretch" spacing={2}>
        <Text fontWeight="semibold" color="gray.700">
          Navigation
        </Text>
        <Text fontSize="sm" color="gray.500">
          Sidebar placeholder - navigation items will be added in future stories
        </Text>
      </VStack>
    </Box>
  );
}
