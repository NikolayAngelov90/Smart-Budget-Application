'use client';

import { useState, useRef, ReactNode } from 'react';
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
import { useTranslations } from 'next-intl';
import type { Insight, InsightMetadata } from '@/types/database.types';
import { InsightErrorBoundary } from './InsightErrorBoundary';
import { trackInsightViewed } from '@/lib/services/analyticsService';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';

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

// Priority label key mapping
const priorityLabelKeys: Record<number, string> = {
  5: 'priorityCritical',
  4: 'priorityHigh',
  3: 'priorityMedium',
  2: 'priorityLow',
  1: 'priorityInfo',
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
  const hasTrackedView = useRef(false);
  const t = useTranslations('insights');
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format;

  const getLocalizedText = (): { title: string; description: string } => {
    const meta = insight.metadata as InsightMetadata | null;
    const categoryName = meta?.category_name ?? '';
    const fmt = (amount?: number) => formatCurrency(amount ?? 0, undefined, currencyCode);

    switch (insight.type) {
      case 'spending_increase': {
        if (meta?.percent_change != null && meta?.current_amount != null && meta?.previous_amount != null) {
          return {
            title: t('spending_increase_title', {
              categoryName,
              percent: Math.round(meta.percent_change),
            }),
            description: t('spending_increase_desc', {
              categoryName,
              percent: Math.round(meta.percent_change),
              currentAmount: fmt(meta.current_amount),
              previousAmount: fmt(meta.previous_amount),
            }),
          };
        }
        break;
      }
      case 'budget_recommendation': {
        if (meta?.recommended_budget != null && meta?.three_month_average != null) {
          return {
            title: t('budget_recommendation_title', {
              budget: fmt(meta.recommended_budget),
              categoryName,
            }),
            description: t('budget_recommendation_desc', {
              average: fmt(meta.three_month_average),
              budget: fmt(meta.recommended_budget),
              categoryName,
            }),
          };
        }
        break;
      }
      case 'unusual_expense': {
        if (meta?.transaction_amount != null && meta?.category_average != null) {
          return {
            title: t('unusual_expense_title', {
              categoryName,
              amount: fmt(meta.transaction_amount),
            }),
            description: t('unusual_expense_desc', {
              categoryName,
              amount: fmt(meta.transaction_amount),
              typical: fmt(meta.category_average),
            }),
          };
        }
        break;
      }
      case 'positive_reinforcement': {
        if (meta?.percent_under_budget != null && meta?.savings_amount != null) {
          return {
            title: t('positive_reinforcement_title', { categoryName }),
            description: t('positive_reinforcement_desc', {
              categoryName,
              percent: Math.round(meta.percent_under_budget),
              savings: fmt(meta.savings_amount),
            }),
          };
        }
        break;
      }
    }
    // Fallback to stored values if metadata is missing
    return { title: insight.title ?? '', description: insight.description ?? '' };
  };

  const { title: localizedTitle, description: localizedDescription } = getLocalizedText();

  const colorScheme = getColorScheme(insight.type);
  const icon = getIcon(insight.type);
  const priorityLabelKey = priorityLabelKeys[insight.priority] || 'priorityUnknown';
  const priorityLabel = t(priorityLabelKey);
  const priorityColorScheme = getPriorityColorScheme(insight.priority);

  const handleAction = () => {
    if (isDismissed && onUndismiss) {
      onUndismiss(insight.id);
    } else {
      onDismiss(insight.id);
    }
  };

  const handleSeeDetails = () => {
    // Track insight view event once per card (AC-9.4.4)
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      trackInsightViewed(insight.id, insight.type);
    }

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
          aria-label={isDismissed ? t('restoreInsight') : t('dismissInsight')}
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
          title={isDismissed ? t('undismiss') : t('dismiss')}
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
            {t('dismissedBadge')}
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
              {t('priority', { priority: insight.priority })} - {priorityLabel}
            </Badge>
          </HStack>

          {/* Title */}
          <Text
            fontWeight="bold"
            fontSize={{ base: 'md', md: 'lg' }}
            color="gray.800"
            lineHeight="shorter"
          >
            {localizedTitle}
          </Text>

          {/* Description */}
          <Text
            fontSize={{ base: 'sm', md: 'md' }}
            color="gray.600"
            lineHeight="base"
          >
            {localizedDescription}
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
                  ? t('openDetailsModal')
                  : isExpanded
                    ? t('hideDetailsLabel')
                    : t('showDetails')
              }
              aria-expanded={!isMobile && isExpanded}
              mt={2}
            >
              {isMobile ? t('seeDetails') : isExpanded ? t('hideDetails') : t('seeDetails')}
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
