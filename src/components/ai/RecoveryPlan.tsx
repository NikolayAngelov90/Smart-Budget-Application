'use client';

/**
 * RecoveryPlan Component
 * Story 12.4 / FR4: 30-Day Budget Recovery Plans
 *
 * Surfaces an active recovery plan with per-category progress, or a coaching
 * call-to-action when the user has overspent categories. Progressive disclosure:
 * renders nothing when no plan is active and none can be generated.
 *
 * Coaching tone throughout — encouraging, never shaming. Over-target uses
 * orange (warning) with a text label, never color alone (a11y / NFR28).
 */

import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
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
import { useRecoveryPlan } from '@/lib/hooks/useRecoveryPlan';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { formatAmount } from '@/lib/utils/formatAmount';
import { FinancialDisclaimer } from '@/components/ai/FinancialDisclaimer';
import type { RecoveryTargetProgress } from '@/types/database.types';

function CategoryRow({
  category,
  currency,
}: {
  category: RecoveryTargetProgress;
  currency: string;
}) {
  const t = useTranslations('recoveryPlan');
  const pct = Math.min(category.pct_of_target, 100);

  return (
    <Box px={4} py={3} borderBottom="1px solid" borderColor="gray.100">
      <Flex align="center" justify="space-between" gap={2} mb={2} flexWrap="wrap">
        <HStack flex="1" minW={0}>
          <Box w={3} h={3} borderRadius="full" bg={category.category_color} flexShrink={0} aria-hidden="true" />
          <Text fontWeight="medium" noOfLines={1}>
            {category.category_name}
          </Text>
          {category.on_track ? (
            <Badge colorScheme="green" flexShrink={0}>
              {t('onTrack')}
            </Badge>
          ) : (
            <Badge colorScheme="orange" flexShrink={0}>
              {t('overTarget')}
            </Badge>
          )}
        </HStack>
        <Text
          fontSize="sm"
          color="gray.600"
          aria-label={`${t('spentSoFar')}: ${formatAmount(category.current_spend, currency)}, ${t('monthlyTarget')}: ${formatAmount(category.monthly_target, currency)}`}
        >
          {formatAmount(category.current_spend, currency)} / {formatAmount(category.monthly_target, currency)}
        </Text>
      </Flex>
      <Progress
        value={pct}
        size="sm"
        borderRadius="full"
        colorScheme={category.on_track ? 'green' : 'orange'}
        aria-label={`${category.category_name} ${category.pct_of_target}% ${t('monthlyTarget')}`}
      />
    </Box>
  );
}

export function RecoveryPlan() {
  const t = useTranslations('recoveryPlan');
  const { plan, canGenerate, isLoading, generate, dismiss } = useRecoveryPlan();
  const { preferences } = useUserPreferences();
  const currency = preferences?.currency_format ?? '';
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Progressive disclosure: nothing to show
  if (!plan && !canGenerate && !isLoading) return null;

  if (isLoading) {
    return <Skeleton height="180px" borderRadius="md" data-testid="recovery-plan-skeleton" />;
  }

  // No active plan, but the user has overspent categories → coaching CTA
  if (!plan && canGenerate) {
    const handleGenerate = async () => {
      setBusy(true);
      try {
        await generate();
      } catch {
        toast({ title: t('actionFailed'), status: 'error', duration: 4000, isClosable: true });
      } finally {
        setBusy(false);
      }
    };
    return (
      <Box as="section" aria-label={t('title')} borderRadius="md" border="1px solid" borderColor="orange.200" bg="orange.50" p={4}>
        <VStack align="start" spacing={3}>
          <Heading as="h2" fontSize={{ base: '1.1rem', lg: '1.25rem' }} color="gray.800">
            {t('ctaTitle')}
          </Heading>
          <Text fontSize="sm" color="gray.700">
            {t('ctaBody')}
          </Text>
          <Button colorScheme="orange" size="sm" onClick={handleGenerate} isLoading={busy}>
            {t('createButton')}
          </Button>
          <FinancialDisclaimer />
        </VStack>
      </Box>
    );
  }

  if (!plan) return null;

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await dismiss(plan.plan.id);
    } catch {
      toast({ title: t('actionFailed'), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box as="section" aria-label={t('title')}>
      <VStack align="stretch" spacing={4}>
        <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
          <VStack align="start" spacing={0}>
            <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700">
              {t('title')}
            </Heading>
            <Text fontSize="sm" color="gray.500">
              {t('subtitle', { day: plan.days_elapsed, daysRemaining: plan.days_remaining })}
            </Text>
          </VStack>
          <Button size="xs" variant="ghost" colorScheme="gray" onClick={handleDismiss} isLoading={busy}>
            {t('dismiss')}
          </Button>
        </Flex>

        <Box borderRadius="md" border="1px solid" borderColor="gray.200" overflow="hidden">
          {plan.categories.map((c) => (
            <CategoryRow key={c.category_id} category={c} currency={currency} />
          ))}
        </Box>

        <FinancialDisclaimer />
      </VStack>
    </Box>
  );
}
