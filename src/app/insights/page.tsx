import { Suspense } from 'react';
import { Box, Center, Spinner } from '@chakra-ui/react';
import { InsightsPageContent } from '@/components/insights/InsightsPageContent';

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        // Shell-level fallback only — the client content renders its own
        // localized loading state once it mounts.
        <Box maxW="1200px" mx="auto" p={{ base: 4, md: 6 }}>
          <Center w="full" py={12}>
            <Spinner size="xl" color="accent" />
          </Center>
        </Box>
      }
    >
      <InsightsPageContent />
    </Suspense>
  );
}
