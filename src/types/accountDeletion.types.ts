/**
 * The contract between DELETE /api/user/account and the deletion dialog for a
 * REFUSED deletion (spec-account-deletion-refused-message). Shared by the server
 * and the client, so it holds no code that either side cannot load.
 */

/** The response code the dialog maps to a translated refusal text. */
export const ACCOUNT_NOT_DELETED = 'ACCOUNT_NOT_DELETED';

/**
 * Which refusal text is TRUE. The approved "nothing else changed" texts are only
 * true when no shared object moved, hence four outcomes and not two.
 */
export type RefusalOutcome = 'unchanged' | 'transferred' | 'transferredShared' | 'shared';

/** The 500 body for a confirmed refusal: a code and live parameters, never text. */
export interface DeletionRefusedBody {
  error: {
    /** English, for logs only; the dialog never shows it. */
    message: string;
    code: typeof ACCOUNT_NOT_DELETED;
    outcome: RefusalOutcome;
    /** Present for every outcome except `unchanged`. */
    household?: string;
    /** The household's owner, as the household page names members (email). */
    owner?: string;
  };
}
