'use client';

import { VStack, Text, Card, CardBody, Icon } from '@chakra-ui/react';
import { InfoIcon, SearchIcon } from '@chakra-ui/icons';

interface EmptyInsightsStateProps {
  message: string;
  hasFilters?: boolean;
}

export function EmptyInsightsState({ message, hasFilters = false }: EmptyInsightsStateProps) {
  return (
    <Card w="full" bg="gray.50" borderStyle="dashed" borderWidth="2px" borderColor="gray.300">
      <CardBody py={12}>
        <VStack spacing={4}>
          <Icon
            as={hasFilters ? SearchIcon : InfoIcon}
            boxSize={12}
            color="gray.400"
          />
          <Text
            fontSize="lg"
            fontWeight="medium"
            color="gray.700"
            textAlign="center"
          >
            {message}
          </Text>
          {hasFilters && (
            <Text fontSize="sm" color="gray.500" textAlign="center">
              Try adjusting your filters or search terms
            </Text>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
