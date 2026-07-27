'use client';

/**
 * Personalization — Story 16.8
 *
 * How the app tailors itself: the gamification opt-out, the progressive-
 * disclosure escape hatch, the values plan and achievements. The Values and
 * Achievements cards used to sit ABOVE the user's own account info on the old
 * page; they are feature content, so they belong here.
 */

import {
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Switch,
  VStack,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { AchievementsSection } from '@/components/settings/AchievementsSection';
import { ValuesPlanSection } from '@/components/values/ValuesPlanSection';
import { useSettingsProfile } from '@/lib/hooks/useSettingsProfile';
import { SettingsSectionGate } from '@/components/settings/SettingsSectionGate';

export function PersonalizationSection() {
  const t = useTranslations('settings');
  const {
    isReady,
    gamificationEnabled,
    setGamificationEnabled,
    showAllFeatures,
    setShowAllFeatures,
    updatePreference,
  } = useSettingsProfile();

  return (
    <SettingsSectionGate isReady={isReady}>
      <VStack spacing={6} align="stretch">
        <Card>
          <CardBody>
            <VStack spacing={6} align="stretch">
              {/* Story 15.6: master gamification opt-in/out. UI-only —
                  updatePreference scope-mutates PROFILE_KEY, the same SWR key
                  useGamification reads, so the gate flips everywhere */}
              <FormControl>
                <HStack mb={1}>
                  <FormLabel htmlFor="gamification-toggle" mb="0">
                    {t('gamificationToggle')}
                  </FormLabel>
                  <Switch
                    id="gamification-toggle"
                    isChecked={gamificationEnabled}
                    onChange={(e) => {
                      setGamificationEnabled(e.target.checked);
                      updatePreference('gamification_enabled', e.target.checked);
                    }}
                  />
                </HStack>
                <FormHelperText mt={0}>{t('gamificationToggleDescription')}</FormHelperText>
              </FormControl>

              {/* Story 15.7: progressive-disclosure escape hatch — reveal all
                  usage-gated features immediately. Revalidates DISCLOSURE_KEY on
                  flip (the pref is read server-side by the disclosure GET). */}
              <FormControl>
                <HStack mb={1}>
                  <FormLabel htmlFor="show-all-features-toggle" mb="0">
                    {t('showAllFeatures')}
                  </FormLabel>
                  <Switch
                    id="show-all-features-toggle"
                    isChecked={showAllFeatures}
                    onChange={(e) => {
                      setShowAllFeatures(e.target.checked);
                      updatePreference('disclosure_show_all', e.target.checked);
                    }}
                  />
                </HStack>
                <FormHelperText mt={0}>{t('showAllFeaturesDescription')}</FormHelperText>
              </FormControl>

              <Divider />

              <Button variant="outline" colorScheme="brand" isDisabled>
                {t('restartOnboarding')}
              </Button>
            </VStack>
          </CardBody>
        </Card>

        <ValuesPlanSection />
        <AchievementsSection />
      </VStack>
    </SettingsSectionGate>
  );
}
