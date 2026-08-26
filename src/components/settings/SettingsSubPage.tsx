'use client';

/**
 * Shared shell for a Settings sub-page — Story 16.8
 *
 * Every group (`/settings/account`, `/settings/notifications`, …) renders
 * through this so the back affordance, title and spacing are identical, and a
 * new group is a few lines rather than another copy of the page chrome.
 *
 * Story 17.1 moved the chrome itself into `SubPageShell`, shared with Household.
 * This keeps its own public API (i18n KEYS in the `settings` namespace) so all
 * eight settings routes are untouched, and keeps supplying `AppLayout`, which
 * settings needs because there is no `(dashboard)/layout.tsx`.
 */

import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';
import { SubPageShell } from '@/components/layout/SubPageShell';

interface SettingsSubPageProps {
  /** i18n key (settings namespace) for the group title. */
  titleKey: string;
  /** Optional one-line description under the title. */
  descriptionKey?: string;
  children: React.ReactNode;
}

export function SettingsSubPage({ titleKey, descriptionKey, children }: SettingsSubPageProps) {
  const t = useTranslations('settings');

  return (
    <AppLayout>
      <SubPageShell
        backHref="/settings"
        backLabel={t('title')}
        backAriaLabel={t('backToSettings')}
        title={t(titleKey)}
        description={descriptionKey ? t(descriptionKey) : undefined}
      >
        {children}
      </SubPageShell>
    </AppLayout>
  );
}
