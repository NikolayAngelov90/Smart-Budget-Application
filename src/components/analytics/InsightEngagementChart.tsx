'use client';

/**
 * InsightEngagementChart — Story 12.8
 * Grouped bar chart of views vs dismissals per insight type.
 */

import { Box, Heading, Text } from '@chakra-ui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import type { InsightEngagementPoint } from '@/types/database.types';
import { useChartColors } from '@/lib/hooks/useChartColors';

export function InsightEngagementChart({ data }: { data: InsightEngagementPoint[] }) {
  const chart = useChartColors();
  const t = useTranslations('analytics');

  return (
    <Box as="section" aria-label={t('insightEngagement')} borderWidth="1px" borderColor="border" borderRadius="md" p={4}>
      <Heading as="h3" size="sm" mb={3} color="fg">{t('insightEngagement')}</Heading>
      {data.length === 0 ? (
        <Text fontSize="sm" color="fg.subtle">{t('noData')}</Text>
      ) : (
        <Box h="280px">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="insight_type" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="views" name={t('views')} fill={chart.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="dismissals" name={t('dismissals')} fill={chart.expense} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
