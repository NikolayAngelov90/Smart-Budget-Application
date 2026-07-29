'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { AboutSection } from '@/components/settings/sections/AboutSection';

export default function AboutSectionPage() {
  return (
    <SettingsSubPage titleKey="aboutHeading">
      <AboutSection />
    </SettingsSubPage>
  );
}
