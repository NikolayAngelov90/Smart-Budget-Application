'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';

export default function SecuritySectionPage() {
  return (
    <SettingsSubPage titleKey="privacyAndSecurity">
      <SecuritySection />
    </SettingsSubPage>
  );
}
