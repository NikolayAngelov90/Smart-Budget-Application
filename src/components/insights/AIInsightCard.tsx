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
  ArrowUpIcon,
} from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';
import type { Insight, InsightMetadata } from '@/types/database.types';
import { InsightErrorBoundary } from './InsightErrorBoundary';
import { trackInsightViewed } from '@/lib/services/analyticsService';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatCurrency } from '@/lib/utils/currency';
import { getInsightToneTokens } from '@/lib/utils/insightGroups';

interface AIInsightCardProps {
  insight: Insight;
  onDismiss: (id: string) => void;
  onUndismiss?: (id: string) => void;
  isDismissed?: boolean;
  expandable?: boolean;
  children?: ReactNode; // Metadata content to display when expanded
  onOpenModal?: () => void; // For mobile: trigger detail modal
  /** "lead" = the spotlight card at the top of the page (Story 16.4, AC2). */
  variant?: 'default' | 'lead';
}

/**
 * Icon per insight type. Story 16.4: covers all SIX enum values — the Epic-12
 * types (`spending_anomaly`, `new_high_spend_category`) previously fell through
 * to a generic info icon.
 */
const getIcon = (type: string) => {
  const iconMap: Record<string, JSX.Element> = {
    spending_increase: <WarningIcon boxSize={5} />,
    budget_recommendation: <InfoIcon boxSize={5} />,
    unusual_expense: <WarningTwoIcon boxSize={5} />,
    positive_reinforcement: <CheckCircleIcon boxSize={5} />,
    spending_anomaly: <WarningTwoIcon boxSize={5} />,
    new_high_spend_category: <ArrowUpIcon boxSize={5} />,
  };
  return iconMap[type] || <InfoIcon boxSize={5} />;
};

/**
 * Priority is only surfaced when it carries meaning. A badge on every card
 * ("Priority 1 - Info") was noise that competed with the insight itself, so
 * only critical/high are labelled.
 */
const priorityLabelKeys: Record<number, string> = {
  5: 'priorityCritical',
  4: 'priorityHigh',
};

export function AIInsightCard({
  insight,
  onDismiss,
  onUndismiss,
  isDismissed = false,
  expandable = false,
  children,
  onOpenModal,
  variant = 'default',
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

  // Story 16.4: colour comes from the shared taxonomy (semantic tokens), not a
  // per-component Chakra colour scheme.
  const { fg: toneFg, subtle: toneSubtle } = getInsightToneTokens(insight.type);
  const icon = getIcon(insight.type);
  const isLead = variant === 'lead';
  // Only critical/high get a badge — see priorityLabelKeys.
  const priorityLabelKey = priorityLabelKeys[insight.priority];
  const priorityLabel = priorityLabelKey ? t(priorityLabelKey) : null;

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
      borderLeft={isLead ? '6px' : '4px'}
      borderColor={isDismissed ? 'border' : toneFg}
      position="relative"
      _hover={{
        shadow: 'md',
        transform: 'translateY(-2px)',
        transition: 'all 0.2s',
      }}
      minH="44px"
      w="full"
      opacity={isDismissed ? 0.6 : 1}
      bg={isDismissed ? 'surface.sunken' : 'surface'}
      // The lead card carries a little more presence than the stream below it.
      boxShadow={isLead && !isDismissed ? 'md' : undefined}
    >
      <CardBody p={isLead ? { base: 5, md: 7 } : { base: 4, md: 5 }}>
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
          color="fg.muted"
          _hover={{
            bg: isDismissed ? 'income.subtle' : 'surface.hover',
            color: isDismissed ? 'income' : 'fg',
          }}
          title={isDismissed ? t('undismiss') : t('dismiss')}
        />

        {/* Dismissed badge */}
        {isDismissed && (
          <Badge
            bg="surface.sunken"
            color="fg.muted"
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
          {/* Icon + (only meaningful) priority label */}
          <HStack spacing={3} w="full">
            <Flex color={toneFg} alignItems="center" justifyContent="center">
              {icon}
            </Flex>
            {priorityLabel && (
              <Badge
                bg={toneSubtle}
                color={toneFg}
                fontSize="2xs"
                px={2}
                py={1}
                borderRadius="md"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {priorityLabel}
              </Badge>
            )}
          </HStack>

          {/* Title */}
          <Text
            fontWeight={isLead ? 700 : 'bold'}
            fontFamily={isLead ? 'heading' : undefined}
            fontSize={isLead ? { base: 'lg', md: '2xl' } : { base: 'md', md: 'lg' }}
            letterSpacing={isLead ? 'tight' : undefined}
            color="fg"
            lineHeight="shorter"
          >
            {localizedTitle}
          </Text>

          {/* Description */}
          <Text
            fontSize={isLead ? { base: 'sm', md: 'lg' } : { base: 'sm', md: 'md' }}
            color="fg.muted"
            lineHeight="base"
          >
            {localizedDescription}
          </Text>

          {/* See Details Button (only if expandable) */}
          {expandable && (
            <Button
              size="sm"
              variant="ghost"
              color="accent"
              _hover={{ bg: 'accent.subtle' }}
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
                borderColor="border"
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
