'use client';

/**
 * Story 11.2: Subscription Detection (Subscription Graveyard)
 * Component: SubscriptionGraveyard
 *
 * Main list view of detected subscriptions using Chakra Accordion.
 * Integrated into AI Insights section with progressive disclosure gating.
 * Only rendered when user has 3+ months of transaction data.
 */

import {
  Accordion,
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Skeleton,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useSubscriptions } from '@/lib/hooks/useSubscriptions';
import { SubscriptionItem } from './SubscriptionItem';

/**
 * SubscriptionGraveyard — Accordion-based list of detected subscriptions.
 * Hidden when user has <3 months of data (progressive disclosure per UX spec).
 */
export function SubscriptionGraveyard() {
  const t = useTranslations('subscriptions');
  const toast = useToast();
  const { subscriptions, hasHistory, isLoading, error, mutate } =
    useSubscriptions();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = useCallback(
    async (id: string, status: 'dismissed' | 'kept') => {
      setUpdatingId(id);
      try {
        const response = await fetch(`/api/subscriptions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Failed to update');
        }

        toast({
          title: status === 'dismissed' ? t('actionDismissed') : t('actionKept'),
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        mutate();
      } catch {
        toast({
          title: t('actionError'),
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [mutate, t, toast]
  );

  // Progressive disclosure: don't render if user doesn't have enough history
  if (!isLoading && !hasHistory) {
    return null;
  }

  if (isLoading) {
    return (
      <Card w="full">
        <CardBody>
          <VStack spacing={3}>
            <Skeleton height="20px" width="200px" />
            <Skeleton height="60px" width="full" />
            <Skeleton height="60px" width="full" />
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return null;
  }

  return (
    <Card w="full">
      <CardHeader pb={2}>
        <Heading size="sm">{t('title')}</Heading>
        <Text fontSize="xs" color="gray.500" mt={1}>
          {t('subtitle')}
        </Text>
      </CardHeader>
      <CardBody pt={0}>
        {subscriptions.length === 0 ? (
          <Box py={4}>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              {t('emptyState')}
            </Text>
          </Box>
        ) : (
          <Accordion allowMultiple>
            {subscriptions.map((sub) => (
              <SubscriptionItem
                key={sub.id}
                subscription={sub}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={updatingId === sub.id}
              />
            ))}
          </Accordion>
        )}
      </CardBody>
    </Card>
  );
}
