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
  | 'shared_plans_received'
  /**
   * A deletion was REFUSED after the household was transferred: the transfer
   * stands, so the new owner is told - neutrally, nothing about a deletion
   * (spec-refused-deletion-notice). Its own kind ON PURPOSE: an older app maps
   * household_transferred to "its creator deleted their account" whatever the
   * cause, but returns no message for a kind it does not know (hidden, never
   * falsified).
   */
  | 'household_now_yours'
  /**
   * The same, for the refused attempt's OTHER changes, which stand too
   * (spec-refused-deletion-neutral-variants): shared goals or budgets and a
   * renamed shared category moved to the owner, and copies made for someone who
   * used the person's categories. New kinds for the same reason.
   */
  | 'shared_plans_now_yours'
  | 'shared_category_renamed'
  | 'category_copies_made';

/**
 * Why the change happened. The neutral kinds' causes - `ownership_transferred`,
 * `copies_made` - name the change itself, not the refused deletion behind it:
 * the payload must not reveal what the neutral text withholds.
 */
export type AccountNoticeCause =
  | 'account_deleted'
  | 'member_removed'
  | 'ownership_transferred'
  | 'copies_made';

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
  'household_now_yours',
  'categories_copied',
  'category_copies_made',
  'shared_plans_received',
  'shared_plans_now_yours',
  'category_renamed',
  'shared_category_renamed',
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

/** The copied names, or [] when the params cannot name them. */
const copiedNames = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((n): n is string => text(n) !== null) : [];

/** "A, B and C" for the locale; a plain join where Intl.ListFormat is missing (old Safari). */
function formatList(names: string[], locale: string): string {
  return typeof Intl.ListFormat === 'function'
    ? new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
    : names.join(', ');
}

/**
 * The keys and values for a notice, or `null` when its params cannot fill the
 * text. A notice is never shown with a hole in it - nor with a claim its cause
 * does not back: a text that says someone deleted their account, or that you
 * removed a member, needs exactly that cause (the database pairs them too).
 */
export function noticeMessage(notice: AccountNotice, locale: string): NoticeMessage | null {
  const p = notice.params ?? {};
  switch (notice.kind) {
    case 'household_transferred': {
      const household = text(p.household);
      if (!household || notice.cause !== 'account_deleted') return null;
      // "As its longest-standing member" only when the database KNEW it (every
      // candidate had a join date). Absent means not known: no claim.
      return {
        titleKey: 'householdTransferredTitle',
        bodyKey:
          p.seniority === true ? 'householdTransferredBody' : 'householdTransferredBodyNoSeniority',
        values: { household },
      };
    }
    case 'household_now_yours': {
      // Only the transfer, which really happened: no "its creator deleted their
      // account", no seniority.
      const household = text(p.household);
      return household
        ? {
            titleKey: 'householdNowYoursTitle',
            bodyKey: 'householdNowYoursBody',
            values: { household },
          }
        : null;
    }
    case 'categories_copied': {
      const copied = copiedNames(p.categories);
      if (copied.length === 0 || notice.cause !== 'account_deleted') return null;
      // "A household member" only when the recipient shares the household with
      // the person who left; otherwise (e.g. a former member) a neutral subject.
      return {
        titleKey: 'categoriesCopiedTitle',
        bodyKey:
          p.shared_household === true ? 'categoriesCopiedBody' : 'categoriesCopiedBodyOutside',
        values: { categories: formatList(copied, locale) },
      };
    }
    case 'category_copies_made': {
      // No subject at all: whose categories they were, and why, is not told.
      const copied = copiedNames(p.categories);
      return copied.length > 0
        ? {
            titleKey: 'categoryCopiesMadeTitle',
            bodyKey: 'categoryCopiesMadeBody',
            values: { categories: formatList(copied, locale) },
          }
        : null;
    }
    case 'category_renamed': {
      const from = text(p.from);
      const to = text(p.to);
      return from && to
        ? { titleKey: 'categoryRenamedTitle', bodyKey: 'categoryRenamedBody', values: { from, to } }
        : null;
    }
    case 'shared_category_renamed': {
      const from = text(p.from);
      const to = text(p.to);
      const household = text(p.household);
      return from && to && household
        ? {
            titleKey: 'sharedCategoryRenamedTitle',
            bodyKey: 'sharedCategoryRenamedBody',
            values: { from, to, household },
          }
        : null;
    }
    case 'shared_plans_now_yours': {
      const household = text(p.household);
      return household
        ? {
            titleKey: 'sharedPlansNowYoursTitle',
            bodyKey: 'sharedPlansNowYoursBody',
            values: { household },
          }
        : null;
    }
    case 'shared_plans_received': {
      const household = text(p.household);
      const bodyKey =
        notice.cause === 'member_removed'
          ? 'sharedPlansReceivedBodyRemoved'
          : notice.cause === 'account_deleted'
            ? 'sharedPlansReceivedBodyDeleted'
            : null;
      if (!household || !bodyKey) return null;
      return { titleKey: 'sharedPlansReceivedTitle', bodyKey, values: { household } };
    }
    default:
      return null;
  }
}
