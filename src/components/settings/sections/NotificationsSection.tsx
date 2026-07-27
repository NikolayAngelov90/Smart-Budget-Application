'use client';

/**
 * Notifications — Story 16.8
 *
 * The weekly-digest opt-in used to sit under Preferences while the push
 * controls lived in a separate card, so the two halves of "how the app contacts
 * you" were in different places. They are one group now.
 *
 * The push implementation below is unchanged from Story 12.3 / 15.5.
 */

import { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Select,
  Switch,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { useSettingsProfile } from '@/lib/hooks/useSettingsProfile';
import { SettingsSectionGate } from '@/components/settings/SettingsSectionGate';

type PushPreferenceField =
  | 'push_nudges_enabled'
  | 'push_milestones_enabled'
  | 'push_household_enabled'
  | 'push_digest_enabled'
  | 'push_reengagement_enabled'
  | 'quiet_hours_start'
  | 'quiet_hours_end';

export function NotificationsSection() {
  const t = useTranslations('notifications');
  const tSettings = useTranslations('settings');
  const {
    isReady,
    profile,
    weeklyDigestEnabled,
    setWeeklyDigestEnabled,
    updatePreference,
  } = useSettingsProfile();

  const prefs = profile?.preferences;
  // Defaults preserved exactly from the previous call site (nudges and
  // re-engagement default OFF; the rest default ON).
  const pushNudgesEnabled = prefs?.push_nudges_enabled ?? false;
  const pushMilestonesEnabled = prefs?.push_milestones_enabled ?? true;
  const pushHouseholdEnabled = prefs?.push_household_enabled ?? true;
  const pushDigestEnabled = prefs?.push_digest_enabled ?? true;
  const pushReengagementEnabled = prefs?.push_reengagement_enabled ?? false;
  const quietHoursStart = prefs?.quiet_hours_start ?? 22;
  const quietHoursEnd = prefs?.quiet_hours_end ?? 8;
  const onUpdatePreferences = (field: PushPreferenceField, value: boolean | number) =>
    updatePreference(field, value);
  const toast = useToast();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe, error } = usePushNotifications();
  const [isTesting, setIsTesting] = useState(false);

  const isBlocked = permission === 'denied';

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || t('testFailed'));
      }
      const sent = json?.data?.sent ?? 0;
      toast({
        title: sent > 0 ? t('testSent') : t('testNoDevices'),
        status: sent > 0 ? 'success' : 'warning',
        duration: 4000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('testFailed'),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SettingsSectionGate isReady={isReady}>
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            {/* Email — moved here from Preferences so both channels sit together */}
            <FormControl>
              <HStack mb={1}>
                <FormLabel htmlFor="weekly-digest-toggle" mb="0">
                  {tSettings('weeklyDigest')}
                </FormLabel>
                <Switch
                  id="weekly-digest-toggle"
                  isChecked={weeklyDigestEnabled}
                  onChange={(e) => {
                    setWeeklyDigestEnabled(e.target.checked);
                    updatePreference('weekly_digest_enabled', e.target.checked);
                  }}
                />
              </HStack>
              <FormHelperText mt={0}>{tSettings('weeklyDigestDescription')}</FormHelperText>
            </FormControl>

            <Divider />

            <Text fontSize="sm" fontWeight="semibold" color="fg">
              {t('title')}
            </Text>
            <Text fontSize="sm" color="fg.subtle">
              {t('pushSubtitle')}
            </Text>

            {!isSupported && (
              <Text fontSize="sm" color="fg.subtle">{t('pushNotSupported')}</Text>
            )}

            {isSupported && (
              <VStack spacing={4} align="stretch">
                {/* Clear current status so it's obvious whether push is ON or OFF */}
                <HStack justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="medium" color="fg">
                    {t('statusLabel')}
                  </Text>
                  <Badge
                    colorScheme={isBlocked ? 'red' : isSubscribed ? 'green' : 'gray'}
                    borderRadius="full"
                    px={3}
                    py={1}
                  >
                    {isBlocked ? t('statusBlocked') : isSubscribed ? t('statusOn') : t('statusOff')}
                  </Badge>
                </HStack>

                {/* Enable / disable — label + color reflect the action and current state */}
                <Button
                  size="sm"
                  colorScheme={isSubscribed ? 'gray' : 'blue'}
                  variant={isSubscribed ? 'outline' : 'solid'}
                  isLoading={isLoading}
                  isDisabled={isBlocked}
                  onClick={isSubscribed ? unsubscribe : subscribe}
                  alignSelf="flex-start"
                >
                  {isSubscribed ? t('disablePush') : t('enablePush')}
                </Button>

                {isBlocked && (
                  <Alert status="warning" borderRadius="md" fontSize="sm">
                    <AlertIcon />
                    {t('blockedHelp')}
                  </Alert>
                )}

                {error && !isBlocked && (
                  <Alert status="error" borderRadius="md" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                {/* Verify the whole pipeline end-to-end */}
                {isSubscribed && (
                  <Button size="sm" variant="ghost" colorScheme="brand" onClick={handleTest} isLoading={isTesting} alignSelf="flex-start">
                    {t('sendTest')}
                  </Button>
                )}

                <Text fontSize="xs" color="fg.subtle">
                  {t('iosHint')}
                </Text>

                <Divider />

                {/* Spending nudges toggle */}
                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel mb={0}>{t('spendingNudges')}</FormLabel>
                    <Switch
                      isChecked={pushNudgesEnabled}
                      onChange={(e) => onUpdatePreferences('push_nudges_enabled', e.target.checked)}
                    />
                  </HStack>
                  <FormHelperText>{t('spendingNudgesDescription')}</FormHelperText>
                </FormControl>

                {/* Story 15.5: per-category toggles. NOT gated on isSubscribed:
                    the flags are per-ACCOUNT while isSubscribed is per-DEVICE —
                    hiding them here would strand a user whose phone is
                    subscribed but who opens Settings on an unsubscribed
                    desktop (review 15-5). Same policy as the nudges toggle. */}
                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel mb={0}>{t('categoryMilestones')}</FormLabel>
                    <Switch
                      isChecked={pushMilestonesEnabled}
                      onChange={(e) =>
                        onUpdatePreferences('push_milestones_enabled', e.target.checked)
                      }
                    />
                  </HStack>
                  <FormHelperText>{t('categoryMilestonesDescription')}</FormHelperText>
                </FormControl>

                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel mb={0}>{t('categoryHousehold')}</FormLabel>
                    <Switch
                      isChecked={pushHouseholdEnabled}
                      onChange={(e) =>
                        onUpdatePreferences('push_household_enabled', e.target.checked)
                      }
                    />
                  </HStack>
                  <FormHelperText>{t('categoryHouseholdDescription')}</FormHelperText>
                </FormControl>

                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel mb={0}>{t('categoryDigest')}</FormLabel>
                    <Switch
                      isChecked={pushDigestEnabled}
                      onChange={(e) =>
                        onUpdatePreferences('push_digest_enabled', e.target.checked)
                      }
                    />
                  </HStack>
                  <FormHelperText>{t('categoryDigestDescription')}</FormHelperText>
                </FormControl>

                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel mb={0}>{t('categoryReengagement')}</FormLabel>
                    <Switch
                      isChecked={pushReengagementEnabled}
                      onChange={(e) =>
                        onUpdatePreferences('push_reengagement_enabled', e.target.checked)
                      }
                    />
                  </HStack>
                  <FormHelperText>{t('categoryReengagementDescription')}</FormHelperText>
                </FormControl>

                {/* Quiet hours — always editable so users can configure before subscribing */}
                <FormControl>
                  <FormLabel>{t('quietHoursStart')} (UTC)</FormLabel>
                  <Select
                    value={quietHoursStart}
                    onChange={(e) => onUpdatePreferences('quiet_hours_start', Number(e.target.value))}
                    size="sm"
                    maxW="120px"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>{t('quietHoursEnd')} (UTC)</FormLabel>
                  <Select
                    value={quietHoursEnd}
                    onChange={(e) => onUpdatePreferences('quiet_hours_end', Number(e.target.value))}
                    size="sm"
                    maxW="120px"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </Select>
                </FormControl>
              </VStack>
            )}
          </VStack>
        </CardBody>
      </Card>
    </SettingsSectionGate>
  );
}
