'use client';

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
  Badge,
  HStack,
  useBreakpointValue,
} from '@chakra-ui/react';
import type { Insight } from '@/types/database.types';
import { InsightMetadata } from './InsightMetadata';
import { InsightErrorBoundary } from './InsightErrorBoundary';

interface InsightDetailModalProps {
  insight: Insight | null;
  isOpen: boolean;
  onClose: () => void;
}

// Get insight type label for display
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    spending_increase: 'Spending Increase',
    budget_recommendation: 'Budget Recommendation',
    unusual_expense: 'Unusual Expense',
    positive_reinforcement: 'Positive Feedback',
  };
  return labels[type] || type;
};

// Get color scheme for badge
const getColorScheme = (type: string): string => {
  const colorMap: Record<string, string> = {
    spending_increase: 'orange',
    budget_recommendation: 'blue',
    unusual_expense: 'red',
    positive_reinforcement: 'green',
  };
  return colorMap[type] || 'gray';
};

export function InsightDetailModal({
  insight,
  isOpen,
  onClose,
}: InsightDetailModalProps) {
  // Responsive modal size: full screen on mobile, xl on desktop
  const modalSize = useBreakpointValue({ base: 'full', md: 'xl' });

  if (!insight) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      scrollBehavior="inside"
      isCentered
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        maxH={{ base: '100vh', md: '90vh' }}
        m={{ base: 0, md: 4 }}
      >
        <ModalHeader pb={2}>
          <HStack spacing={3} align="start" flexWrap="wrap">
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="bold" flex="1">
              {insight.title}
            </Text>
            <Badge
              colorScheme={getColorScheme(insight.type)}
              fontSize="sm"
              px={3}
              py={1}
              borderRadius="md"
            >
              {getTypeLabel(insight.type)}
            </Badge>
          </HStack>
          <Text
            fontSize="sm"
            color="gray.600"
            fontWeight="normal"
            mt={2}
            lineHeight="base"
          >
            {insight.description}
          </Text>
        </ModalHeader>

        <ModalCloseButton
          size="lg"
          top={4}
          right={4}
          aria-label="Close insight details"
        />

        <ModalBody pb={6}>
          <InsightErrorBoundary>
            <InsightMetadata insight={insight} />
          </InsightErrorBoundary>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
