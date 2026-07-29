'use client';

import { SettingsSubPage } from '@/components/settings/SettingsSubPage';
import { NotificationsSection } from '@/components/settings/sections/NotificationsSection';

export default function NotificationsSectionPage() {
  return (
    <SettingsSubPage titleKey="notificationsHeading">
      <NotificationsSection />
    </SettingsSubPage>
  );
}
