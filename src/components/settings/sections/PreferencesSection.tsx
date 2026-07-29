'use client';

/**
 * Preferences — regional/display settings: currency, date format, language.
 *
 * Story 16.8: the weekly-digest toggle used to live here; it moved to the
 * Notifications group so it sits with the push controls.
 */

import {
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Select,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { SUPPORTED_CURRENCIES, getEnabledCurrencies } from '@/lib/config/currencies';
import { formatExchangeRate } from '@/lib/utils/currency';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { useSettingsProfile } from '@/lib/hooks/useSettingsProfile';
import type { ExchangeRateResponse } from '@/types/exchangeRate.types';
import { SettingsSectionGate } from '@/components/settings/SettingsSectionGate';

const exchangeRateFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json() as Promise<ExchangeRateResponse>;
};

export function PreferencesSection() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const {
    status,
    error,
    reload,
    currencyFormat,
    dateFormat,
    language,
    updatePreference,
    updateLanguage,
  } = useSettingsProfile();

  // Story 10-5 (AC-10.5.7): exchange rates shown under the currency selector.
  const { data: exchangeRates } = useSWR<ExchangeRateResponse | null>(
    '/api/exchange-rates?base=EUR',
    exchangeRateFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  return (
    <SettingsSectionGate status={status} error={error} onRetry={reload}>
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <FormControl>
              <FormLabel>{t('currencyFormat')}</FormLabel>
              <Select
                value={currencyFormat}
                onChange={(e) => {
                  const newValue = e.target.value as 'USD' | 'EUR' | 'GBP';
                  updatePreference('currency_format', newValue);
                }}
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code} disabled={!currency.enabled}>
                    {currency.code} ({currency.symbol})
                    {!currency.enabled ? ` - ${tCommon('comingSoon')}` : ''}
                  </option>
                ))}
              </Select>
              <Text fontSize="xs" color="fg.subtle" mt={1}>
                {t('currencyDescription')}
              </Text>
              {exchangeRates && exchangeRates.rates && (
                <VStack align="stretch" mt={2} p={2} bg="accent.subtle" borderRadius="md" spacing={1}>
                  {getEnabledCurrencies()
                    .filter((c) => c.code !== 'EUR')
                    .map((c) => (
                      <Text key={c.code} fontSize="xs" color="accent">
                        {formatExchangeRate('EUR', c.code, exchangeRates.rates[c.code] || 0)}
                      </Text>
                    ))}
                  <Text fontSize="xs" color="fg.subtle">
                    {t('ratesUpdatedAt', {
                      date: new Date(exchangeRates.lastFetched).toLocaleDateString(),
                    })}
                  </Text>
                </VStack>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>{t('dateFormat')}</FormLabel>
              <Select
                value={dateFormat}
                onChange={(e) => {
                  const newValue = e.target.value as 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
                  updatePreference('date_format', newValue);
                }}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (European)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </Select>
            </FormControl>

            <LanguageSwitcher currentLocale={language} onLanguageChange={updateLanguage} />
          </VStack>
        </CardBody>
      </Card>
    </SettingsSectionGate>
  );
}
