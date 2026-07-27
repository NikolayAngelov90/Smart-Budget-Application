'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { AppearanceSection } from '@/components/settings/AppearanceSection';

export default function AppearanceSectionPage() {
  return (
    <SettingsSubPage titleKey="appearanceHeading">
      <AppearanceSection />
    </SettingsSubPage>
  );
}
