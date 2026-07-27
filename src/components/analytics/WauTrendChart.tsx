'use client';

/**
 * WauTrendChart — Story 12.8
 * Weekly active users over time.
 */

import { Box, Heading, Text } from '@chakra-ui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import type { WauPoint } from '@/types/database.types';
import { useChartColors } from '@/lib/hooks/useChartColors';

export function WauTrendChart({ data }: { data: WauPoint[] }) {
  const chart = useChartColors();
  const t = useTranslations('analytics');

  return (
    <Box as="section" aria-label={t('wauTrend')} borderWidth="1px" borderColor="border" borderRadius="md" p={4}>
      <Heading as="h3" size="sm" mb={3} color="fg">{t('wauTrend')}</Heading>
      {data.length === 0 ? (
        <Text fontSize="sm" color="fg.subtle">{t('noData')}</Text>
      ) : (
        <Box h="260px">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="active_users" name={t('activeUsers')} stroke={chart.accent} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
