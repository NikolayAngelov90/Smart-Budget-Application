'use client';

/**
 * Account — profile picture, display name, email. Story 16.8 moved this out of
 * the monolithic settings page; the fields and handlers are unchanged.
 */

import {
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { PROFILE_KEY } from '@/hooks/useUserProfile';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useSettingsProfile } from '@/lib/hooks/useSettingsProfile';
import { SettingsSectionGate } from '@/components/settings/SettingsSectionGate';

export function AccountSection() {
  const t = useTranslations('settings');
  const { mutate } = useSWRConfig();
  const {
    isReady,
    profile,
    displayName,
    setDisplayName,
    isSavingProfile,
    updateProfile,
  } = useSettingsProfile();

  return (
    <SettingsSectionGate isReady={isReady}>
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <VStack spacing={4}>
              <ProfilePictureUpload
                currentPictureUrl={profile?.profile_picture_url || null}
                displayName={displayName}
                email={profile?.email || ''}
                onUploadSuccess={async () => {
                  // Refetch profile to pick up new picture URL
                  const res = await fetch('/api/user/profile');
                  if (res.ok) {
                    const json = await res.json();
                    if (json.data) {
                      mutate(PROFILE_KEY, json.data, false);
                    }
                  }
                }}
              />
              {profile?.created_at &&
                (() => {
                  try {
                    const date = new Date(profile.created_at);
                    if (!isNaN(date.getTime())) {
                      return (
                        <Text fontSize="sm" color="fg.muted">
                          {t('memberSince')} {format(date, 'MMMM yyyy')}
                        </Text>
                      );
                    }
                  } catch {
                    // Invalid date, don't display
                  }
                  return null;
                })()}
            </VStack>

            <FormControl>
              <FormLabel>{t('displayName')}</FormLabel>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
              />
            </FormControl>

            <FormControl>
              <FormLabel>{t('email')}</FormLabel>
              <Input value={profile?.email || ''} isReadOnly bg="surface.sunken" />
              <Text fontSize="xs" color="fg.subtle" mt={1}>
                {t('emailReadOnly')}
              </Text>
            </FormControl>

            <Button
              colorScheme="brand"
              onClick={updateProfile}
              isLoading={isSavingProfile}
              loadingText={t('saving')}
              isDisabled={displayName === (profile?.display_name || '')}
            >
              {t('saveProfile')}
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </SettingsSectionGate>
  );
}
