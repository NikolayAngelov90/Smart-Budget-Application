/**
 * The deletion dialog's text for a failed account deletion
 * (spec-account-deletion-refused-message).
 *
 * The server sends a CODE plus live parameters, never text. This picks the
 * translated message that is true for what happened. A 5xx it does not recognise
 * gets the generic translated failure: never a server `message` or `details`
 * string, which are English and were shown verbatim before.
 */

import {
  ACCOUNT_NOT_DELETED,
  type DeletionRefusedBody,
  type RefusalOutcome,
} from '@/types/accountDeletion.types';

/** The settings-namespace translator, narrowed to what this needs. */
export type SettingsTranslate = (key: string, values?: Record<string, string>) => string;

/** A refusal body, if `body` is one; `null` otherwise. */
export function readRefusal(body: unknown): DeletionRefusedBody['error'] | null {
  if (body === null || typeof body !== 'object') return null;
  const error = (body as { error?: unknown }).error;
  if (error === null || typeof error !== 'object') return null;
  return (error as { code?: unknown }).code === ACCOUNT_NOT_DELETED
    ? (error as DeletionRefusedBody['error'])
    : null;
}

/** A refusal whose preparation changed something the app may have cached. */
export function refusalChangedData(body: unknown): boolean {
  const refusal = readRefusal(body);
  return refusal !== null && refusal.outcome !== 'unchanged';
}

export function deletionFailureMessage(
  t: SettingsTranslate,
  status: number,
  body: unknown
): string {
  if (status < 500) {
    // 4xx (wrong or missing password, expired session): the route's `details`,
    // as before. Pre-existing English text - see deferred-work.md.
    const details =
      body !== null && typeof body === 'object'
        ? (body as { error?: { details?: unknown } }).error?.details
        : undefined;
    return typeof details === 'string' && details ? details : t('accountDeleteFailed');
  }

  const refusal = readRefusal(body);
  if (refusal) {
    const household = typeof refusal.household === 'string' ? refusal.household : null;
    const owner = typeof refusal.owner === 'string' ? refusal.owner : null;
    const outcome: RefusalOutcome = refusal.outcome;

    switch (outcome) {
      case 'unchanged':
        return t('deletionRefusedUnchanged');
      case 'transferred':
        if (household && owner) {
          return t('deletionRefusedTransferred', { household, newOwner: owner });
        }
        break;
      case 'transferredShared':
        if (household && owner) {
          return t('deletionRefusedTransferredShared', { household, newOwner: owner });
        }
        break;
      case 'shared':
        if (household && owner) {
          return t('deletionRefusedShared', { household, owner });
        }
        break;
      default: {
        // Every outcome is handled above; a new one fails to compile here.
        const unhandled: never = outcome;
        void unhandled;
      }
    }
  }

  return t('accountDeleteFailed');
}
