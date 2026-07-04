'use client';

/**
 * WhatIfSimulator Component — Story 14.4 (FR16)
 *
 * Exploratory "What If" savings simulator on the goals page: per-category
 * reduction sliders (0–100% of the 3-month average) and cancel-subscription
 * toggles, with LIVE client-side projection via whatIfEngine on every change
 * (UX spec: "Live calculation, no save"). Nothing is persisted or applied —
 * slider state is local and resets on demand.
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Divider,
  Flex,
  Heading,
  Skeleton,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useWhatIf } from '@/lib/hooks/useWhatIf';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { computeWhatIfProjection } from '@/lib/ai/whatIfEngine';
import { formatCurrency } from '@/lib/utils/currency';

export function WhatIfSimulator() {
  const t = useTranslations('whatIf');
  const { data, error, isLoading } = useWhatIf();
  const { preferences } = useUserPreferences();
  const currencyCode = preferences?.currency_format || 'EUR';

  // Exploratory local state only — never persisted (AC #5)
  const [reductions, setReductions] = useState<Record<string, number>>({});
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(new Set());

  const fmt = (n: number) => formatCurrency(n, undefined, currencyCode);

  // Stable references so the projection memo only recomputes on real changes
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const subscriptions = useMemo(() => data?.subscriptions ?? [], [data?.subscriptions]);

  // Live projection: pure engine, recomputed on every slider/toggle change
  const projection = useMemo(
    () =>
      computeWhatIfProjection({
        adjustments: categories.map((c) => ({
          avgMonthly: c.avg_monthly,
          reductionPct: reductions[c.category_id] ?? 0,
        })),
        cancelledMonthlyAmounts: subscriptions
          .filter((s) => cancelled.has(s.id))
          .map((s) => s.monthly_amount),
        goal: data?.goal
          ? {
              name: data.goal.name,
              targetAmount: data.goal.target_amount,
              currentAmount: data.goal.current_amount,
              deadline: data.goal.deadline,
            }
          : null,
        today: new Date(),
      }),
    [categories, subscriptions, reductions, cancelled, data?.goal]
  );

  // Count only adjustments for items still present — revalidation can drop a
  // category/subscription while its stale local entry lingers (14-4 review)
  const hasAdjustments =
    subscriptions.some((s) => cancelled.has(s.id)) ||
    categories.some((c) => (reductions[c.category_id] ?? 0) > 0);

  const handleReset = () => {
    setReductions({});
    setCancelled(new Set());
  };

  return (
    <Box as="section" aria-label={t('title')} mt={{ base: 10, md: 12 }}>
      <Heading as="h2" fontSize={{ base: '1.25rem', lg: '1.5rem' }} color="gray.700" mb={1}>
        {t('title')}
      </Heading>
      <Text fontSize="sm" color="gray.500" mb={4}>
        {t('subtitle')}
      </Text>

      {isLoading && !data && (
        <Skeleton height="160px" borderRadius="md" data-testid="what-if-skeleton" />
      )}

      {!isLoading && error && !data && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {t('loadFailed')}
        </Alert>
      )}

      {data && !data.hasData && (
        <Card>
          <CardBody>
            <Text color="gray.500" fontSize="sm" textAlign="center" py={2}>
              {t('emptyState')}
            </Text>
          </CardBody>
        </Card>
      )}

      {data && data.hasData && (
        <Card>
          <CardBody>
            <Flex direction={{ base: 'column', lg: 'row' }} gap={{ base: 6, lg: 8 }}>
              {/* Adjustments column */}
              <VStack align="stretch" spacing={5} flex={2} minW={0}>
                {categories.map((category) => {
                  const pct = reductions[category.category_id] ?? 0;
                  const reducedTo = category.avg_monthly * (1 - pct / 100);
                  return (
                    <Box key={category.category_id}>
                      <Flex justify="space-between" align="center" mb={1} gap={2}>
                        <Flex align="center" gap={2} minW={0}>
                          <Box
                            w={2.5}
                            h={2.5}
                            borderRadius="full"
                            bg={category.color}
                            flexShrink={0}
                            aria-hidden="true"
                          />
                          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                            {category.name}
                          </Text>
                        </Flex>
                        <Text fontSize="sm" color={pct > 0 ? 'green.600' : 'gray.500'} whiteSpace="nowrap">
                          {pct > 0
                            ? t('reducedTo', { pct, amount: fmt(reducedTo) })
                            : t('avgPerMonth', { amount: fmt(category.avg_monthly) })}
                        </Text>
                      </Flex>
                      <Slider
                        aria-label={t('sliderAriaLabel', { name: category.name })}
                        value={pct}
                        min={0}
                        max={100}
                        step={5}
                        colorScheme="green"
                        onChange={(value) =>
                          setReductions((prev) => ({ ...prev, [category.category_id]: value }))
                        }
                      >
                        <SliderTrack>
                          <SliderFilledTrack />
                        </SliderTrack>
                        {/* Larger thumb on touch devices (44px-target guidance) */}
                        <SliderThumb boxSize={{ base: 7, md: 5 }} />
                      </Slider>
                    </Box>
                  );
                })}

                {subscriptions.length > 0 && (
                  <>
                    {categories.length > 0 && <Divider />}
                    <VStack align="stretch" spacing={3}>
                      <Text fontSize="sm" fontWeight="medium" color="gray.600">
                        {t('subscriptionsHeading')}
                      </Text>
                      {/* Honest-projection hint: subscription charges usually sit
                          inside a category's average, so combined savings overlap */}
                      {categories.length > 0 && (
                        <Text fontSize="xs" color="gray.500">
                          {t('subscriptionsOverlapHint')}
                        </Text>
                      )}
                      {subscriptions.map((sub) => (
                        <Checkbox
                          key={sub.id}
                          isChecked={cancelled.has(sub.id)}
                          colorScheme="green"
                          py={{ base: 2, md: 0.5 }}
                          onChange={(e) =>
                            setCancelled((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(sub.id);
                              else next.delete(sub.id);
                              return next;
                            })
                          }
                        >
                          <Text fontSize="sm">
                            {t('cancelSubscription', {
                              name: sub.name,
                              amount: fmt(sub.monthly_amount),
                            })}
                          </Text>
                        </Checkbox>
                      ))}
                    </VStack>
                  </>
                )}
              </VStack>

              {/* Results column */}
              <VStack
                align="stretch"
                spacing={4}
                flex={1}
                minW={{ lg: '220px' }}
                bg="gray.50"
                borderRadius="md"
                p={4}
                alignSelf={{ lg: 'flex-start' }}
              >
                <Stat>
                  <StatLabel fontSize="xs" color="gray.600">
                    {t('monthlySavings')}
                  </StatLabel>
                  <StatNumber fontSize="xl" color={hasAdjustments ? 'green.600' : 'gray.700'}>
                    {fmt(projection.monthly_savings)}
                  </StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize="xs" color="gray.600">
                    {t('annualSavings')}
                  </StatLabel>
                  <StatNumber fontSize="xl" color={hasAdjustments ? 'green.600' : 'gray.700'}>
                    {fmt(projection.annual_savings)}
                  </StatNumber>
                </Stat>

                {projection.goal_impact && projection.goal_impact.days_earlier > 0 && (
                  <Badge colorScheme="green" px={2} py={1} borderRadius="md" whiteSpace="normal">
                    {projection.goal_impact.months_earlier >= 1
                      ? t('goalEarlierMonths', {
                          goal: projection.goal_impact.goal_name,
                          months: projection.goal_impact.months_earlier,
                        })
                      : t('goalEarlierDays', {
                          goal: projection.goal_impact.goal_name,
                          days: projection.goal_impact.days_earlier,
                        })}
                  </Badge>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  isDisabled={!hasAdjustments}
                  minH={{ base: '44px', md: '32px' }}
                >
                  {t('reset')}
                </Button>

                <Text fontSize="xs" color="gray.500">
                  {t('exploratoryDisclaimer')}
                </Text>
              </VStack>
            </Flex>
          </CardBody>
        </Card>
      )}
    </Box>
  );
}
