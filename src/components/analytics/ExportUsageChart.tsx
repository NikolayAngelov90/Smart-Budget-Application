'use client';

/**
 * ExportUsageChart — Story 12.8
 * CSV vs PDF export counts + volume figures.
 */

import { Box, Heading, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Text } from '@chakra-ui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import type { ExportUsage } from '@/types/database.types';
import { useChartColors } from '@/lib/hooks/useChartColors';

export function ExportUsageChart({ data }: { data: ExportUsage }) {
  const chart = useChartColors();
  const t = useTranslations('analytics');
  const chartData = [
    { format: 'CSV', count: data.csv_count },
    { format: 'PDF', count: data.pdf_count },
  ];
  const hasData = data.csv_count > 0 || data.pdf_count > 0;

  return (
    <Box as="section" aria-label={t('exportUsage')} borderWidth="1px" borderColor="border" borderRadius="md" p={4}>
      <Heading as="h3" size="sm" mb={3} color="fg">{t('exportUsage')}</Heading>
      {!hasData ? (
        <Text fontSize="sm" color="fg.subtle">{t('noData')}</Text>
      ) : (
        <>
          <Box h="200px" mb={3}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="format" stroke={chart.axis} tick={{ fill: chart.tick, fontSize: 12 }} />
                <YAxis allowDecimals={false} stroke={chart.axis} tick={{ fill: chart.tick, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, color: chart.tick }} cursor={{ fill: chart.cursor, fillOpacity: 0.25 }} />
                <Bar dataKey="count" name={t('exports')} fill={chart.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <SimpleGrid columns={2} spacing={4}>
            <Stat>
              <StatLabel>{t('csvVolume')}</StatLabel>
              <StatNumber fontSize="lg">{data.csv_total_transactions}</StatNumber>
              <StatHelpText>{t('transactionsExported')}</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>{t('pdfVolume')}</StatLabel>
              <StatNumber fontSize="lg">{data.pdf_total_pages}</StatNumber>
              <StatHelpText>{t('pagesExported')}</StatHelpText>
            </Stat>
          </SimpleGrid>
        </>
      )}
    </Box>
  );
}
