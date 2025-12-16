'use client';

/**
 * Settings Page
 * Story 8.2: Export Financial Report to PDF
 */

import { useState } from 'react';
import {
  Container,
  Heading,
  VStack,
  Button,
  Select,
  FormControl,
  FormLabel,
  useToast,
  Card,
  CardBody,
  Text,
} from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';
import { format, subMonths } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { exportMonthlyReportToPDF } from '@/lib/services/exportService';
import type { PDFReportData } from '@/types/export.types';

interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  category: {
    id: string;
    name: string;
    color: string;
    type: 'income' | 'expense';
  } | null;
}

export default function SettingsPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();

  // AC-8.2.2: Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  // Handle PDF export
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Fetch monthly transactions
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

      const response = await fetch(
        `/api/transactions?startDate=${startDate}&endDate=${endDate}&all=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const transactions: Transaction[] = data.data;

      // Calculate summary
      const totalIncome = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netBalance = totalIncome - totalExpenses;

      // Calculate category breakdown
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

      // Get top 5 expense transactions
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

      // Assemble PDF data
      const reportData: PDFReportData = {
        month: selectedMonth,
        summary: {
          totalIncome,
          totalExpenses,
          netBalance,
        },
        categories,
        topTransactions,
      };

      // Generate PDF
      await exportMonthlyReportToPDF(reportData);

      // AC-8.2.12: Success toast
      toast({
        title: 'PDF report downloaded!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to generate PDF report. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl" color="gray.800">
            Settings
          </Heading>

          {/* PDF Export Section */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  Export Reports
                </Heading>

                <Text color="gray.600">
                  Generate professional PDF reports of your monthly financial activity.
                </Text>

                <FormControl>
                  <FormLabel>Select Month</FormLabel>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    isDisabled={isExporting}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  leftIcon={<DownloadIcon />}
                  colorScheme="blue"
                  onClick={handleExportPDF}
                  isLoading={isExporting}
                  loadingText="Generating PDF..."
                  size="lg"
                >
                  Export Monthly Report (PDF)
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </AppLayout>
  );
}
