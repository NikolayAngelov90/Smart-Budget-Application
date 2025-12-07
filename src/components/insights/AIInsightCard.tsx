'use client';

import { useState, ReactNode } from 'react';
import {
  Card,
  CardBody,
  Flex,
  Text,
  Badge,
  IconButton,
  HStack,
  VStack,
  Button,
  Collapse,
  Box,
  useBreakpointValue,
} from '@chakra-ui/react';
import {
  CloseIcon,
  WarningIcon,
  InfoIcon,
  WarningTwoIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@chakra-ui/icons';
import type { Insight } from '@/types/database.types';
import { InsightErrorBoundary } from './InsightErrorBoundary';

interface AIInsightCardProps {
  insight: Insight;
  onDismiss: (id: string) => void;
  onUndismiss?: (id: string) => void;
  isDismissed?: boolean;
  expandable?: boolean;
  children?: ReactNode; // Metadata content to display when expanded
  onOpenModal?: () => void; // For mobile: trigger detail modal
}

// Color scheme mapping based on insight type
const getColorScheme = (type: string): string => {
  const colorMap: Record<string, string> = {
    spending_increase: 'orange',
    budget_recommendation: 'blue',
    unusual_expense: 'red',
    positive_reinforcement: 'green',
  };
  return colorMap[type] || 'gray';
};

// Icon mapping based on insight type
const getIcon = (type: string) => {
  const iconMap: Record<string, JSX.Element> = {
    spending_increase: <WarningIcon boxSize={5} />,
    budget_recommendation: <InfoIcon boxSize={5} />,
    unusual_expense: <WarningTwoIcon boxSize={5} />,
    positive_reinforcement: <CheckCircleIcon boxSize={5} />,
  };
  return iconMap[type] || <InfoIcon boxSize={5} />;
};

// Priority label mapping
const getPriorityLabel = (priority: number): string => {
  const labels: Record<number, string> = {
    5: 'Critical',
    4: 'High',
    3: 'Medium',
    2: 'Low',
    1: 'Info',
  };
  return labels[priority] || 'Unknown';
};

// Priority badge color scheme
const getPriorityColorScheme = (priority: number): string => {
  const colors: Record<number, string> = {
    5: 'red',
    4: 'orange',
    3: 'yellow',
    2: 'green',
    1: 'gray',
  };
  return colors[priority] || 'gray';
};

export function AIInsightCard({
  insight,
  onDismiss,
  onUndismiss,
  isDismissed = false,
  expandable = false,
  children,
  onOpenModal,
}: AIInsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const colorScheme = getColorScheme(insight.type);
  const icon = getIcon(insight.type);
  const priorityLabel = getPriorityLabel(insight.priority);
  const priorityColorScheme = getPriorityColorScheme(insight.priority);

  const handleAction = () => {
    if (isDismissed && onUndismiss) {
      onUndismiss(insight.id);
    } else {
      onDismiss(insight.id);
    }
  };

  const handleSeeDetails = () => {
    if (isMobile && onOpenModal) {
      // On mobile, trigger modal
      onOpenModal();
    } else {
      // On desktop, toggle inline expansion
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Card
      borderLeft="4px"
      borderColor={isDismissed ? 'gray.300' : `${colorScheme}.500`}
      position="relative"
      _hover={{
        shadow: 'md',
        transform: 'translateY(-2px)',
        transition: 'all 0.2s',
      }}
      minH="44px"
      w="full"
      opacity={isDismissed ? 0.6 : 1}
      bg={isDismissed ? 'gray.50' : 'white'}
      filter={isDismissed ? 'grayscale(50%)' : 'none'}
    >
      <CardBody p={{ base: 4, md: 5 }}>
        {/* Dismiss/Undismiss button */}
        <IconButton
          aria-label={isDismissed ? 'Restore insight' : 'Dismiss insight'}
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          position="absolute"
          top={2}
          right={2}
          onClick={handleAction}
          minH="44px"
          minW="44px"
          _hover={{
            bg: isDismissed ? 'green.50' : `${colorScheme}.50`,
          }}
          title={isDismissed ? 'Undismiss' : 'Dismiss'}
        />

        {/* Dismissed badge */}
        {isDismissed && (
          <Badge
            colorScheme="gray"
            position="absolute"
            top={2}
            right={14}
            fontSize="xs"
          >
            Dismissed
          </Badge>
        )}

        {/* Content */}
        <VStack align="start" spacing={3} pr={10}>
          {/* Icon and Priority Badge */}
          <HStack spacing={3} w="full">
            <Flex
              color={`${colorScheme}.500`}
              alignItems="center"
              justifyContent="center"
            >
              {icon}
            </Flex>
            <Badge
              colorScheme={priorityColorScheme}
              fontSize={{ base: 'xs', md: 'sm' }}
              px={2}
              py={1}
              borderRadius="md"
            >
              Priority {insight.priority} - {priorityLabel}
            </Badge>
          </HStack>

          {/* Title */}
          <Text
            fontWeight="bold"
            fontSize={{ base: 'md', md: 'lg' }}
            color="gray.800"
            lineHeight="shorter"
          >
            {insight.title}
          </Text>

          {/* Description */}
          <Text
            fontSize={{ base: 'sm', md: 'md' }}
            color="gray.600"
            lineHeight="base"
          >
            {insight.description}
          </Text>

          {/* See Details Button (only if expandable) */}
          {expandable && (
            <Button
              size="sm"
              variant="ghost"
              colorScheme={colorScheme}
              onClick={handleSeeDetails}
              rightIcon={
                isMobile ? undefined : isExpanded ? (
                  <ChevronUpIcon />
                ) : (
                  <ChevronDownIcon />
                )
              }
              aria-label={
                isMobile
                  ? 'Open details in modal'
                  : isExpanded
                    ? 'Hide details'
                    : 'Show details'
              }
              aria-expanded={!isMobile && isExpanded}
              mt={2}
            >
              {isMobile ? 'See Details' : isExpanded ? 'Hide Details' : 'See Details'}
            </Button>
          )}

          {/* Expandable Metadata Section (Desktop only, inline) */}
          {expandable && !isMobile && (
            <Collapse in={isExpanded} animateOpacity style={{ width: '100%' }}>
              <Box
                mt={4}
                pt={4}
                borderTop="1px"
                borderColor="gray.200"
                w="full"
              >
                <InsightErrorBoundary>
                  {children}
                </InsightErrorBoundary>
              </Box>
            </Collapse>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
