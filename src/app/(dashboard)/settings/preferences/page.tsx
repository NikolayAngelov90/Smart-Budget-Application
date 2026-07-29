'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { PreferencesSection } from '@/components/settings/sections/PreferencesSection';

export default function PreferencesSectionPage() {
  return (
    <SettingsSubPage titleKey="preferences">
      <PreferencesSection />
    </SettingsSubPage>
  );
}
