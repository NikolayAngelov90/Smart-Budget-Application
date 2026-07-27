'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { DataSection } from '@/components/settings/sections/DataSection';

export default function DataSectionPage() {
  return (
    <SettingsSubPage titleKey="exportData">
      <DataSection />
    </SettingsSubPage>
  );
}
