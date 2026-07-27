'use client';

/**
 * Data & export — Story 16.8
 *
 * CSV / PDF export plus the sync-status readout. Export handlers moved verbatim
 * from the old settings page.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Select,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';
import { format, subMonths } from 'date-fns';
import { useTranslations } from 'next-intl';
import { exportMonthlyReportToPDF, exportTransactionsToCSV } from '@/lib/services/exportService';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { useSettingsProfile } from '@/lib/hooks/useSettingsProfile';
import type { PDFReportData } from '@/types/export.types';

/** Local shape used by the export handlers (the joined row, not the DB row). */
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  created_at: string;
  category: {
    id: string;
    name: string;
    color: string;
    type: 'income' | 'expense';
  } | null;
}

export function DataSection() {
  const t = useTranslations('settings');
  const toast = useToast();
  const { currencyFormat } = useSettingsProfile();

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // AC-8.2.2: Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return { value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') };
  });

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const [year = '', month = ''] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      const response = await fetch(
        `/api/transactions?startDate=${startDate}&endDate=${endDate}&all=true`
      );

      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      const transactions: Transaction[] = data.data;

      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const categoryMap = new Map<string, { amount: number; color: string }>();
      transactions
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          const catName = t.category?.name || 'Unknown';
          const catColor = t.category?.color || '#gray';
          const existing = categoryMap.get(catName) || { amount: 0, color: catColor };
          categoryMap.set(catName, { amount: existing.amount + t.amount, color: catColor });
        });

      const categories = Array.from(categoryMap.entries())
        .map(([name, data]) => ({
          name,
          amount: data.amount,
          percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
          color: data.color,
        }))
        .sort((a, b) => b.amount - a.amount);

      const topTransactions = transactions
        .filter((t) => t.type === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((t) => ({
          date: t.date,
          category: t.category?.name || 'Unknown',
          amount: t.amount,
          notes: t.notes || '',
        }));

      const reportData: PDFReportData = {
        month: selectedMonth,
        summary: { totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses },
        categories,
        topTransactions,
      };

      await exportMonthlyReportToPDF(reportData, currencyFormat);

      toast({
        title: t('pdfDownloaded'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: t('pdfFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    try {
      const response = await fetch('/api/transactions?all=true');
      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      const transactions: Transaction[] = data.data;

      await exportTransactionsToCSV(transactions, undefined, currencyFormat);

      toast({
        title: t('csvDownloaded'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: t('csvFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExportingCSV(false);
    }
  };
  return (
    <VStack spacing={6} align="stretch">
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Text color="fg.muted">{t('exportDescription')}</Text>

            <Divider />

            <FormControl>
              <FormLabel>{t('selectMonth')}</FormLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                isDisabled={isExportingPDF}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            <HStack spacing={4} flexWrap="wrap">
              <Button
                leftIcon={<DownloadIcon />}
                colorScheme="brand"
                onClick={handleExportPDF}
                isLoading={isExportingPDF}
                loadingText={t('generatingPdf')}
                flex={{ base: 'none', sm: '1' }}
                w={{ base: 'full', sm: 'auto' }}
                minW={{ base: 0, sm: '200px' }}
                whiteSpace="normal"
                h="auto"
                py={2}
              >
                {t('exportMonthlyReport')}
              </Button>

              <Button
                leftIcon={<DownloadIcon />}
                colorScheme="green"
                onClick={handleExportCSV}
                isLoading={isExportingCSV}
                loadingText={t('generatingCsv')}
                flex={{ base: 'none', sm: '1' }}
                w={{ base: 'full', sm: 'auto' }}
                minW={{ base: 0, sm: '200px' }}
                whiteSpace="normal"
                h="auto"
                py={2}
              >
                {t('exportAllTransactions')}
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Story 8.4: Data Sync Status — AC-8.4.2 */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('dataSyncStatus')}
            </Text>
            <SyncStatusIndicator />
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
