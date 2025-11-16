import { Heading, Text, VStack } from '@chakra-ui/react';

export default function DashboardPage() {
  return (
    <VStack align="start" spacing={4}>
      <Heading as="h2" size="xl" color="trustBlue.600">
        Dashboard
      </Heading>
      <Text color="gray.600">
        Dashboard content will be added in future stories
      </Text>
    </VStack>
  );
}
