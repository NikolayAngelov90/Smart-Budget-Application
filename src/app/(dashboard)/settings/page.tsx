'use client';

/**
 * Settings Page
 * Story 8.2: Export Financial Report to PDF
 * Story 8.3: Settings Page and Account Management
 * Story 9.6: Complete Device Session Management
 *
 * AC-8.3.1: Settings page at /settings route
 * AC-8.3.2: Account Information section
 * AC-8.3.3: Data Export section
 * AC-8.3.4: Privacy & Security section
 * AC-8.3.5: Preferences section
 * AC-8.3.6: Optimistic UI updates
 * AC-8.3.7: Success feedback
 * AC-8.3.8: Account deletion confirmation
 * AC-8.3.9: Mobile responsive
 * AC-9.6.2: Active Devices section
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Heading,
  VStack,
  Button,
  Select,
  FormControl,
  FormLabel,
  Input,
  useToast,
  Card,
  CardBody,
  Text,
  HStack,
  Divider,
  useDisclosure,
  Spinner,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { DownloadIcon, DeleteIcon } from '@chakra-ui/icons';
import { format, subMonths } from 'date-fns';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { AppLayout } from '@/components/layout/AppLayout';
import { exportMonthlyReportToPDF, exportTransactionsToCSV } from '@/lib/services/exportService';
import { ConfirmDeleteModal } from '@/components/settings/ConfirmDeleteModal';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { ActiveDevicesSection } from '@/components/settings/ActiveDevicesSection';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import type { SupportedLocale } from '@/i18n/routing';
import type { PDFReportData } from '@/types/export.types';
import { SUPPORTED_CURRENCIES, getEnabledCurrencies } from '@/lib/config/currencies';
import { formatExchangeRate } from '@/lib/services/exchangeRateService';
import type { ExchangeRateResponse } from '@/types/exchangeRate.types';
import type { UserProfile } from '@/types/user.types';

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to fetch');
  return data.data;
};

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');

  // Data fetching with SWR (AC-8.3.6: Optimistic UI)
  const { data: profile, error, isLoading } = useSWR<UserProfile>('/api/user/profile', fetcher);

  // Exchange rate fetching (Story 10-5: AC-10.5.7)
  const exchangeRateFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<ExchangeRateResponse>;
  };
  const { data: exchangeRates } = useSWR<ExchangeRateResponse | null>(
    '/api/exchange-rates?base=EUR',
    exchangeRateFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  // State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currencyFormat, setCurrencyFormat] = useState<'USD' | 'EUR' | 'GBP'>('EUR');
  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'>(
    'MM/DD/YYYY'
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [language, setLanguage] = useState<SupportedLocale>('en');

  // Modal control
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Initialize form fields from profile data
  useEffect(() => {
    if (profile?.preferences) {
      setDisplayName(profile.display_name || '');
      setCurrencyFormat(profile.preferences.currency_format);
      setDateFormat(profile.preferences.date_format);
      setLanguage(profile.preferences.language || 'en');
    }
  }, [profile]);

  // AC-8.2.2: Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  // AC-8.3.2, AC-8.3.6, AC-8.3.7: Update profile with optimistic UI
  const handleUpdateProfile = async () => {
    if (!profile) return;

    setIsSavingProfile(true);

    try {
      // Optimistic update
      const optimisticProfile = {
        ...profile,
        display_name: displayName,
      };

      mutate('/api/user/profile', optimisticProfile, false);

      // Send update request
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Revalidate
      await mutate('/api/user/profile');

      // AC-8.3.7: Success toast
      toast({
        title: t('profileUpdated'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating profile:', error);

      // Revert optimistic update
      await mutate('/api/user/profile');

      toast({
        title: t('profileUpdateFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // AC-8.3.5, AC-8.3.6, AC-8.3.7: Update preferences
  const handleUpdatePreferences = async (field: 'currency_format' | 'date_format', value: string) => {
    if (!profile) return;

    try {
      // Optimistic update
      const optimisticProfile = {
        ...profile,
        preferences: {
          ...profile.preferences,
          [field]: value,
        },
      };

      mutate('/api/user/profile', optimisticProfile, false);

      // Send update request
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: { [field]: value },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Revalidate
      await mutate('/api/user/profile');

      // AC-8.3.7: Success toast
      toast({
        title: t('preferencesUpdated'),
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating preferences:', error);

      // Revert optimistic update
      await mutate('/api/user/profile');

      toast({
        title: t('preferencesUpdateFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // AC-10.1.4, AC-10.1.5: Update language preference and persist
  const handleLanguageChange = async (newLocale: SupportedLocale) => {
    if (!profile) return;
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { language: newLocale } }),
      });
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  // AC-8.2: Export PDF report
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

  // AC-8.1: Export CSV
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

  // AC-8.3.8: Account deletion with password confirmation
  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_password: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.details || 'Failed to delete account');
      }

      // Account deleted successfully
      toast({
        title: t('accountDeleted'),
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Logout and redirect to login page
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error('Error deleting account:', error);
      setIsDeleting(false);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <Container maxW="container.xl" py={8}>
          <VStack spacing={8}>
            <Spinner size="xl" />
            <Text>{tCommon('loading')}</Text>
          </VStack>
        </Container>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <Container maxW="container.xl" py={8}>
          <Alert status="error">
            <AlertIcon />
            {t('failedToLoadProfile')}
          </Alert>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl" color="gray.800">
            {t('title')}
          </Heading>

          {/* AC-8.3.2: Account Information Section */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  {t('accountInformation')}
                </Heading>

                <VStack spacing={4}>
                  {/* Profile Picture Upload - Phase 2 */}
                  <ProfilePictureUpload
                    currentPictureUrl={profile?.profile_picture_url || null}
                    displayName={displayName}
                    email={profile?.email || ''}
                    onUploadSuccess={(newUrl) => {
                      console.log('Profile picture updated:', newUrl);
                    }}
                  />
                  {profile?.created_at && (() => {
                    try {
                      const date = new Date(profile.created_at);
                      if (!isNaN(date.getTime())) {
                        return (
                          <Text fontSize="sm" color="gray.600">
                            {t('memberSince')} {format(date, 'MMMM yyyy')}
                          </Text>
                        );
                      }
                    } catch {
                      // Invalid date, don't display
                    }
                    return null;
                  })()}
                </VStack>

                <FormControl>
                  <FormLabel>{t('displayName')}</FormLabel>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('displayNamePlaceholder')}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>{t('email')}</FormLabel>
                  <Input value={profile?.email || ''} isReadOnly bg="gray.50" />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {t('emailReadOnly')}
                  </Text>
                </FormControl>

                <Button
                  colorScheme="blue"
                  onClick={handleUpdateProfile}
                  isLoading={isSavingProfile}
                  loadingText={t('saving')}
                  isDisabled={displayName === (profile?.display_name || '')}
                >
                  {t('saveProfile')}
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* AC-8.3.3: Data Export Section */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  {t('exportData')}
                </Heading>

                <Text color="gray.600">
                  {t('exportDescription')}
                </Text>

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
                    colorScheme="blue"
                    onClick={handleExportPDF}
                    isLoading={isExportingPDF}
                    loadingText={t('generatingPdf')}
                    flex="1"
                    minW="200px"
                  >
                    {t('exportMonthlyReport')}
                  </Button>

                  <Button
                    leftIcon={<DownloadIcon />}
                    colorScheme="green"
                    onClick={handleExportCSV}
                    isLoading={isExportingCSV}
                    loadingText={t('generatingCsv')}
                    flex="1"
                    minW="200px"
                  >
                    {t('exportAllTransactions')}
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* AC-8.3.5: Preferences Section */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  {t('preferences')}
                </Heading>

                <FormControl>
                  <FormLabel>{t('currencyFormat')}</FormLabel>
                  <Select
                    value={currencyFormat}
                    onChange={(e) => {
                      const newValue = e.target.value as 'USD' | 'EUR' | 'GBP';
                      setCurrencyFormat(newValue);
                      handleUpdatePreferences('currency_format', newValue);
                    }}
                  >
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <option
                        key={currency.code}
                        value={currency.code}
                        disabled={!currency.enabled}
                      >
                        {currency.code} ({currency.symbol})
                        {!currency.enabled ? ` - ${tCommon('comingSoon')}` : ''}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {t('currencyDescription')}
                  </Text>
                  {/* AC-10.5.7: Exchange rate display */}
                  {exchangeRates && exchangeRates.rates && (
                    <VStack align="stretch" mt={2} p={2} bg="blue.50" borderRadius="md" spacing={1}>
                      {getEnabledCurrencies()
                        .filter((c) => c.code !== 'EUR')
                        .map((c) => (
                          <Text key={c.code} fontSize="xs" color="blue.700">
                            {formatExchangeRate('EUR', c.code, exchangeRates.rates[c.code] || 0)}
                          </Text>
                        ))}
                      <Text fontSize="xs" color="gray.500">
                        {t('ratesUpdatedAt', { date: new Date(exchangeRates.lastFetched).toLocaleDateString() })}
                      </Text>
                    </VStack>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>{t('dateFormat')}</FormLabel>
                  <Select
                    value={dateFormat}
                    onChange={(e) => {
                      const newValue = e.target.value as
                        | 'MM/DD/YYYY'
                        | 'DD/MM/YYYY'
                        | 'YYYY-MM-DD';
                      setDateFormat(newValue);
                      handleUpdatePreferences('date_format', newValue);
                    }}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (European)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  </Select>
                </FormControl>

                {/* AC-10.1.4: Language Switcher */}
                <LanguageSwitcher
                  currentLocale={language}
                  onLanguageChange={handleLanguageChange}
                />

                <Divider />

                <Button variant="outline" colorScheme="blue" isDisabled>
                  {t('restartOnboarding')}
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* Story 8.4: Data Sync Status Section - AC-8.4.2 */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  {t('dataSyncStatus')}
                </Heading>

                <VStack spacing={4} align="stretch">
                  <Text fontSize="sm" color="gray.600">
                    {t('dataSyncDescription')}
                  </Text>

                  {/* AC-8.4.1, AC-8.4.2: Sync Status with Last Sync Timestamp */}
                  <SyncStatusIndicator compact={false} showTimestamp={true} />

                  <Alert status="success" variant="left-accent">
                    <AlertIcon />
                    {t('syncDescription')}
                  </Alert>
                </VStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Story 9.6: Active Devices Section - AC-9.6.2 */}
          <ActiveDevicesSection />

          {/* AC-8.3.4: Privacy & Security Section */}
          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Heading as="h2" size="md" color="gray.700">
                  {t('privacyAndSecurity')}
                </Heading>

                <Alert status="info" variant="left-accent">
                  <AlertIcon />
                  {t('bankLevelEncryption')}
                </Alert>

                <Divider />

                <VStack align="stretch" spacing={3}>
                  <Text fontWeight="bold" color="red.600">
                    {t('dangerZone')}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {t('deleteAccountWarning')}
                  </Text>
                  <Button
                    leftIcon={<DeleteIcon />}
                    colorScheme="red"
                    variant="outline"
                    onClick={onOpen}
                  >
                    {t('deleteAccount')}
                  </Button>
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>

      {/* AC-8.3.8: Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </AppLayout>
  );
}
