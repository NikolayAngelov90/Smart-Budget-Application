'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { PersonalizationSection } from '@/components/settings/sections/PersonalizationSection';

export default function PersonalizationSectionPage() {
  return (
    <SettingsSubPage titleKey="personalizationHeading">
      <PersonalizationSection />
    </SettingsSubPage>
  );
}
