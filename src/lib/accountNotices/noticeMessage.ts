/**
 * Account notices: which message a notice shows (spec-account-deletion-notifications).
 *
 * ONE mapping, used by the dashboard card (useTranslations) and by the push
 * (createTranslator in the recipient's stored language), so the two can never
 * say different things. Client-safe: no server imports.
 *
 * A notice stores a KIND, a CAUSE and non-personal params - never text, and
 * never the departed person. The text lives in messages/{en,bg}.json under
 * `accountNotices`.
 */

export type AccountNoticeKind =
  | 'household_transferred'
  | 'categories_copied'
  | 'category_renamed'
  | 'shared_plans_received';

export type AccountNoticeCause = 'account_deleted' | 'member_removed';

export interface AccountNotice {
  id: string;
  kind: AccountNoticeKind;
  cause: AccountNoticeCause;
  household_id: string | null;
  params: Record<string, unknown>;
  created_at: string;
}

/** Shown and pushed in this order: the biggest change first. */
export const NOTICE_PRIORITY: readonly AccountNoticeKind[] = [
  'household_transferred',
  'categories_copied',
  'shared_plans_received',
  'category_renamed',
];

export function byPriority(a: AccountNotice, b: AccountNotice): number {
  return (
    NOTICE_PRIORITY.indexOf(a.kind) - NOTICE_PRIORITY.indexOf(b.kind) ||
    a.created_at.localeCompare(b.created_at)
  );
}

export interface NoticeMessage {
  /** Keys in the `accountNotices` namespace. */
  titleKey: string;
  bodyKey: string;
  /** ICU values. Strings only: a list is already formatted for the locale. */
  values: Record<string, string>;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** "A, B and C" for the locale; a plain join where Intl.ListFormat is missing (old Safari). */
function formatList(names: string[], locale: string): string {
  return typeof Intl.ListFormat === 'function'
    ? new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
    : names.join(', ');
}

/**
 * The keys and values for a notice, or `null` when its params cannot fill the
 * text. A notice is never shown with a hole in it.
 */
export function noticeMessage(notice: AccountNotice, locale: string): NoticeMessage | null {
  const p = notice.params ?? {};
  switch (notice.kind) {
    case 'household_transferred': {
      const household = text(p.household);
      if (!household) return null;
      // "As its longest-standing member" only when the database KNEW it (every
      // candidate had a join date). Absent means not known: no claim.
      return {
        titleKey: 'householdTransferredTitle',
        bodyKey:
          p.seniority === true ? 'householdTransferredBody' : 'householdTransferredBodyNoSeniority',
        values: { household },
      };
    }
    case 'categories_copied': {
      const names = Array.isArray(p.categories)
        ? p.categories.filter((n): n is string => text(n) !== null)
        : [];
      if (names.length === 0) return null;
      // "A household member" only when the recipient shares the household with
      // the person who left; otherwise (e.g. a former member) a neutral subject.
      return {
        titleKey: 'categoriesCopiedTitle',
        bodyKey:
          p.shared_household === true ? 'categoriesCopiedBody' : 'categoriesCopiedBodyOutside',
        values: { categories: formatList(names, locale) },
      };
    }
    case 'category_renamed': {
      const from = text(p.from);
      const to = text(p.to);
      return from && to
        ? { titleKey: 'categoryRenamedTitle', bodyKey: 'categoryRenamedBody', values: { from, to } }
        : null;
    }
    case 'shared_plans_received': {
      const household = text(p.household);
      if (!household) return null;
      return {
        titleKey: 'sharedPlansReceivedTitle',
        bodyKey:
          notice.cause === 'member_removed'
            ? 'sharedPlansReceivedBodyRemoved'
            : 'sharedPlansReceivedBodyDeleted',
        values: { household },
      };
    }
    default:
      return null;
  }
}
