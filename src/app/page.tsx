'use client';

import { Container, Heading, Text, Button, VStack } from '@chakra-ui/react';

export default function Home() {
  return (
    <Container maxW="container.xl" py={20}>
      <VStack spacing={8} align="center">
        <Heading as="h1" size="2xl" textAlign="center" color="trustBlue.500">
          Smart Budget Application
        </Heading>
        <Text fontSize="xl" textAlign="center" color="gray.600">
          AI-powered personal finance tracker with smart insights
        </Text>
        <Button colorScheme="trustBlue" size="lg">
          Get Started
        </Button>
      </VStack>
    </Container>
  );
}
