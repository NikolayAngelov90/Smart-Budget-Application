'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { AccountSection } from '@/components/settings/sections/AccountSection';

export default function AccountSectionPage() {
  return (
    <SettingsSubPage titleKey="accountInformation">
      <AccountSection />
    </SettingsSubPage>
  );
}
