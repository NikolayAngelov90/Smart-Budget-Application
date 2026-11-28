'use client';

/**
 * The translated message for a refused name (spec-cyrillic-names): turns a
 * problem code from checkName / nameSchema into the reader's language, from the
 * `names` namespace. Anything that is not a problem code is passed through.
 */

import { useTranslations } from 'next-intl';
import { isNameProblem, NAME_LIMITS, type NameField } from '@/lib/validation/names';

export function useNameMessage() {
  const t = useTranslations('names');
  return (message: string | undefined, field: NameField): string | undefined =>
    isNameProblem(message) ? t(message, { max: NAME_LIMITS[field] }) : message;
}
