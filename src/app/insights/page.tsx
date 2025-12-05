import { Suspense } from 'react';
import { Box, Center, Spinner, VStack, Text } from '@chakra-ui/react';
import { InsightsPageContent } from '@/components/insights/InsightsPageContent';

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <Box maxW="1200px" mx="auto" p={{ base: 4, md: 6 }}>
          <Center w="full" py={12}>
            <VStack spacing={4}>
              <Spinner size="xl" color="blue.500" />
              <Text color="gray.600">Loading insights...</Text>
            </VStack>
          </Center>
        </Box>
      }
    >
      <InsightsPageContent />
    </Suspense>
  );
}
