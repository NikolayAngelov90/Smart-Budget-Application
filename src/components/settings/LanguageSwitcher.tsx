/**
 * Story 10-1: i18n Framework Setup & Language Switcher
 * Component: LanguageSwitcher
 *
 * AC-10.1.4: Language Switcher in Settings
 * - Dropdown in preferences section
 * - Switches between supported locales (en, bg)
 * - Updates NEXT_LOCALE cookie + user preferences
 * - Reloads page to apply new locale
 */

'use client';

import { FormControl, FormLabel, Select } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/routing';

interface LanguageSwitcherProps {
  currentLocale: string;
  onLanguageChange?: (locale: SupportedLocale) => void;
}

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  bg: 'Български',
};

export function LanguageSwitcher({ currentLocale, onLanguageChange }: LanguageSwitcherProps) {
  const t = useTranslations('settings');
  const [isChanging, setIsChanging] = useState(false);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLocale = e.target.value as SupportedLocale;
      if (newLocale === currentLocale) return;

      setIsChanging(true);

      // Set the NEXT_LOCALE cookie for server-side locale detection
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;

      // Notify parent to persist to user profile
      if (onLanguageChange) {
        onLanguageChange(newLocale);
      }

      // Reload to apply the new locale
      window.location.reload();
    },
    [currentLocale, onLanguageChange]
  );

  return (
    <FormControl>
      <FormLabel>{t('language')}</FormLabel>
      <Select
        value={currentLocale}
        onChange={handleChange}
        isDisabled={isChanging}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </Select>
    </FormControl>
  );
}
