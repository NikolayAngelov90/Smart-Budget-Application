'use client';

/**
 * Shell + membership gate for a `/household/*` sub-page — Story 17.1.
 *
 * Wraps `SubPageShell` (shared with Settings) and adds the gate every sub-page
 * needs: someone who is not in a household must not be shown the chrome of a
 * page that cannot do anything. They are sent back to `/household`, which is the
 * only household route that has something to offer them — the create form.
 *
 * This is PRESENTATION ONLY. The real enforcement is server-side, in the
 * membership-gated RPCs behind these endpoints; a redirect is a courtesy, not a
 * security boundary, and nothing here weakens the former.
 *
 * `AppLayout` is deliberately absent: `src/app/household/layout.tsx` supplies it
 * for every route underneath, so adding it here would nest two app shells.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton, VStack } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { useHousehold } from '@/lib/hooks/useHousehold';
import { SubPageShell } from '@/components/layout/SubPageShell';

interface HouseholdSubPageProps {
  /** i18n key (householdDashboard namespace) for the sub-page title. */
  titleKey: string;
  /** Optional one-line description under the title. */
  descriptionKey?: string;
  children: React.ReactNode;
}

export function HouseholdSubPage({ titleKey, descriptionKey, children }: HouseholdSubPageProps) {
  const t = useTranslations('householdDashboard');
  const router = useRouter();
  const { household, isLoading } = useHousehold();

  const shouldRedirect = !isLoading && !household;
  useEffect(() => {
    if (shouldRedirect) router.replace('/household');
  }, [shouldRedirect, router]);

  // While we do not yet know, and while the redirect is in flight, show the
  // shell's skeleton rather than a flash of an empty group.
  if (isLoading || shouldRedirect) {
    return (
      <SubPageShell
        backHref="/household"
        backLabel={t('title')}
        backAriaLabel={t('backToHousehold')}
        title={t(titleKey)}
      >
        <VStack align="stretch" spacing={4}>
          <Skeleton height="80px" borderRadius="md" />
          <Skeleton height="120px" borderRadius="md" />
        </VStack>
      </SubPageShell>
    );
  }

  return (
    <SubPageShell
      backHref="/household"
      backLabel={t('title')}
      backAriaLabel={t('backToHousehold')}
      title={t(titleKey)}
      description={descriptionKey ? t(descriptionKey) : undefined}
    >
      {children}
    </SubPageShell>
  );
}
