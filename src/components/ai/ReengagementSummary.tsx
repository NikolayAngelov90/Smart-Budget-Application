'use client';

/**
 * ReengagementSummary Component
 * Story 12.6 / FR8: Lapsed User Re-engagement Analysis
 *
 * A no-guilt welcome-back banner for users returning after 14+ days away.
 * Re-orients them with typical spend, active subscriptions, goal progress, and
 * one recommended action. Progressive disclosure: renders nothing when there
 * is no summary (active user, new user, or already dismissed).
 */

import { useState } from 'react';
import {
  Badge,
  Box,
  Card,
  CardBody,
  CloseButton,
  Flex,
  Heading,
  HStack,
  Progress,
  Skeleton,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useReengagement } from '@/lib/hooks/useReengagement';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';

export function ReengagementSummary() {
  const t = useTranslations('reengagement');
  const { summary, isLoading, dismiss } = useReengagement();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Progressive disclosure
  if (!summary && !isLoading) return null;

  if (isLoading) {
    return <Skeleton height="200px" borderRadius="md" data-testid="reengagement-skeleton" />;
  }

  if (!summary) return null;

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await dismiss();
    } catch {
      toast({ title: t('actionFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card borderLeft="4px solid" borderColor="trustBlue.500" bg="trustBlue.50" as="section" aria-label={t('title')}>
      <CardBody>
        <Flex justify="space-between" align="start" gap={2}>
          <VStack align="start" spacing={1} flex="1">
            <Heading as="h2" size="md" color="gray.800">
              {t('title')}
            </Heading>
            <Text fontSize="sm" color="gray.600">
              {t('subtitle', { days: summary.lapsed_days })}
            </Text>
          </VStack>
          <CloseButton size="sm" onClick={handleDismiss} isDisabled={busy} aria-label={t('dismiss')} />
        </Flex>

        <VStack align="stretch" spacing={3} mt={4}>
          {/* Typical monthly spend */}
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" color="gray.600">{t('typicalSpend')}</Text>
            <Text fontWeight="semibold" aria-label={`${t('typicalSpend')}: ${formatAmount(summary.typical_monthly_spend, currency)}`}>
              {formatAmount(summary.typical_monthly_spend, currency)}
            </Text>
          </Flex>

          {/* Subscriptions */}
          {summary.active_subscription_count > 0 && (
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="gray.600">
                {t('subscriptions', { count: summary.active_subscription_count })}
              </Text>
              <Text fontWeight="medium">
                {t('subscriptionsTotal', { total: formatAmount(summary.active_subscription_monthly_total, currency) })}
              </Text>
            </Flex>
          )}

          {/* Goals */}
          {summary.goals.length > 0 && (
            <Box>
              <Text fontSize="sm" color="gray.600" mb={2}>{t('goalsHeading')}</Text>
              <VStack align="stretch" spacing={2}>
                {summary.goals.map((g) => (
                  <Box key={g.id}>
                    <Flex justify="space-between" mb={1}>
                      <Text fontSize="sm" noOfLines={1}>{g.name}</Text>
                      <Text fontSize="sm" fontWeight="medium">{g.pct}%</Text>
                    </Flex>
                    <Progress value={Math.min(g.pct, 100)} size="sm" borderRadius="full" colorScheme="green" aria-label={`${g.name} ${g.pct}%`} />
                  </Box>
                ))}
              </VStack>
            </Box>
          )}

          {/* Recommended action */}
          <Box bg="white" borderRadius="md" p={3} border="1px solid" borderColor="trustBlue.200">
            <HStack align="start" spacing={2}>
              <Badge colorScheme="blue" flexShrink={0}>{t('recommendedAction')}</Badge>
              <Text fontSize="sm" color="gray.700">{summary.recommended_action}</Text>
            </HStack>
          </Box>

          <FinancialDisclaimer />
        </VStack>
      </CardBody>
    </Card>
  );
}
