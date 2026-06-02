'use client';

/**
 * Engagement Analytics Dashboard Page — Story 12.8
 *
 * Role-gated, read-only dashboard. Access is enforced server-side (the API
 * returns 403 for non-analytics_viewers); this page shows an access-denied
 * state in that case.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Container,
  Heading,
  HStack,
  Skeleton,
  Text,
  VStack,
  Alert as ChakraAlert,
  AlertIcon,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAnalyticsDashboard } from '@/lib/hooks/useAnalyticsDashboard';
import { InsightEngagementChart } from '@/components/analytics/InsightEngagementChart';
import { ExportUsageChart } from '@/components/analytics/ExportUsageChart';
import { PwaInstallsChart } from '@/components/analytics/PwaInstallsChart';
import { WauTrendChart } from '@/components/analytics/WauTrendChart';
import type { AnalyticsRange } from '@/types/database.types';

const RANGES: AnalyticsRange[] = [7, 30, 90];

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const [range, setRange] = useState<AnalyticsRange>(30);
  const { data, isLoading, isForbidden } = useAnalyticsDashboard(range);

  return (
    <AppLayout>
      <Container maxW="1200px" py={{ base: 4, md: 6 }}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading as="h1" size="lg" mb={1}>{t('title')}</Heading>
            <Text color="gray.600" fontSize="sm">{t('subtitle')}</Text>
          </Box>

          {isForbidden ? (
            <ChakraAlert status="warning" borderRadius="md">
              <AlertIcon />
              {t('accessDenied')}
            </ChakraAlert>
          ) : (
            <>
              {/* Date range selector */}
              <ButtonGroup size="sm" isAttached variant="outline" alignSelf="flex-start">
                {RANGES.map((r) => (
                  <Button
                    key={r}
                    onClick={() => setRange(r)}
                    colorScheme={range === r ? 'blue' : 'gray'}
                    variant={range === r ? 'solid' : 'outline'}
                  >
                    {t('rangeDays', { days: r })}
                  </Button>
                ))}
              </ButtonGroup>

              {isLoading || !data ? (
                <VStack align="stretch" spacing={4} data-testid="analytics-loading">
                  <Skeleton height="280px" borderRadius="md" />
                  <Skeleton height="220px" borderRadius="md" />
                </VStack>
              ) : (
                <VStack align="stretch" spacing={6}>
                  <HStack justify="space-between" flexWrap="wrap">
                    <Text fontSize="sm" color="gray.500">
                      {t('totalEvents', { count: data.total_events })}
                    </Text>
                  </HStack>

                  <InsightEngagementChart data={data.insight_engagement} />
                  <ExportUsageChart data={data.export_usage} />
                  <PwaInstallsChart data={data.pwa_installs_by_platform} total={data.pwa_installs_total} />
                  <WauTrendChart data={data.wau_trend} />

                  <Text fontSize="xs" color="gray.400" fontStyle="italic">
                    {t('notInstrumented')}
                  </Text>
                </VStack>
              )}
            </>
          )}
        </VStack>
      </Container>
    </AppLayout>
  );
}
