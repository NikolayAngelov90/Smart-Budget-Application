'use client';

/**
 * PwaInstallsChart — Story 12.8
 * PWA installs by platform + total.
 */

import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import type { PwaInstallsByPlatform } from '@/types/database.types';

export function PwaInstallsChart({ data, total }: { data: PwaInstallsByPlatform[]; total: number }) {
  const t = useTranslations('analytics');

  return (
    <Box as="section" aria-label={t('pwaInstalls')} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={4}>
      <Flex justify="space-between" align="baseline" mb={3}>
        <Heading as="h3" size="sm" color="gray.700">{t('pwaInstalls')}</Heading>
        <Text fontSize="sm" color="gray.600">{t('total')}: <strong>{total}</strong></Text>
      </Flex>
      {data.length === 0 ? (
        <Text fontSize="sm" color="gray.500">{t('noData')}</Text>
      ) : (
        <Box h="220px">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name={t('installs')} fill="#38a169" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}
