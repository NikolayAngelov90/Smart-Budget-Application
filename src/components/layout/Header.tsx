'use client';

import { Box, Flex, Heading } from '@chakra-ui/react';

export function Header() {
  return (
    <Box as="header" bg="trustBlue.500" color="white" px={4} py={3} boxShadow="sm">
      <Flex align="center" maxW="container.xl" mx="auto">
        <Heading as="h1" size="md">
          Smart Budget
        </Heading>
      </Flex>
    </Box>
  );
}
