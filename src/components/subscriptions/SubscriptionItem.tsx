'use client';

/**
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 * Component: SubscriptionItem
 *
 * Renders a single detected subscription with merchant name, amount,
 * frequency, status badge, and action buttons (dismiss/keep).
 */

import {
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  Button,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { DetectedSubscription, SubscriptionStatus } from '@/types/database.types';

interface SubscriptionItemProps {
  subscription: DetectedSubscription;
  onUpdateStatus: (id: string, status: 'dismissed' | 'kept') => void;
  isUpdating: boolean;
}

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'green',
  unused: 'orange',
  dismissed: 'gray',
  kept: 'blue',
};

export function SubscriptionItem({
  subscription,
  onUpdateStatus,
  isUpdating,
}: SubscriptionItemProps) {
  const t = useTranslations('subscriptions');

  const frequencyLabel = t(
    `frequency${subscription.frequency.charAt(0).toUpperCase() + subscription.frequency.slice(1)}` as
      | 'frequencyWeekly'
      | 'frequencyMonthly'
      | 'frequencyQuarterly'
      | 'frequencyAnnual'
  );

  const statusLabel = (() => {
    switch (subscription.status) {
      case 'active':
        return t('statusActive');
      case 'unused':
        return t('statusUnused');
      case 'kept':
        return t('statusKept');
      case 'dismissed':
        return t('statusDismissed');
    }
  })();

  const formattedAmount = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: subscription.currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(subscription.estimated_amount);

  const lastSeenFormatted = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(subscription.last_seen_at));

  const canAct = subscription.status === 'active' || subscription.status === 'unused';

  return (
    <AccordionItem border="1px" borderColor="gray.200" borderRadius="md" mb={2}>
      <AccordionButton
        py={3}
        px={4}
        _hover={{ bg: 'gray.50' }}
        aria-label={`${subscription.merchant_pattern} - ${formattedAmount} ${frequencyLabel}`}
      >
        <HStack flex="1" spacing={3} align="center">
          <VStack align="start" spacing={0} flex="1">
            <Text fontWeight="semibold" fontSize="sm" textTransform="capitalize">
              {subscription.merchant_pattern}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {formattedAmount} · {frequencyLabel}
            </Text>
          </VStack>
          <Badge
            colorScheme={STATUS_COLORS[subscription.status]}
            fontSize="xs"
            px={2}
            py={0.5}
            borderRadius="full"
          >
            {statusLabel}
          </Badge>
        </HStack>
        <AccordionIcon ml={2} />
      </AccordionButton>

      <AccordionPanel pb={4} px={4}>
        <VStack align="stretch" spacing={3}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600">
              {t('lastCharge')}
            </Text>
            <Text fontSize="sm" fontWeight="medium">
              {lastSeenFormatted}
            </Text>
          </HStack>

          {canAct && (
            <HStack spacing={2} pt={1}>
              <Button
                size="sm"
                variant="outline"
                colorScheme="gray"
                onClick={() => onUpdateStatus(subscription.id, 'dismissed')}
                isDisabled={isUpdating}
                flex="1"
              >
                {t('dismiss')}
              </Button>
              <Button
                size="sm"
                variant="solid"
                colorScheme="blue"
                onClick={() => onUpdateStatus(subscription.id, 'kept')}
                isDisabled={isUpdating}
                flex="1"
              >
                {t('keep')}
              </Button>
            </HStack>
          )}
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
}
