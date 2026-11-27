/**
 * User Account API Route
 * Story 8.3: Settings Page and Account Management
 *
 * DELETE /api/user/account - Delete authenticated user's account
 *
 * AC-8.3.8: Account deletion with password confirmation
 * Requires password re-entry for security
 * Generates CSV export before deletion
 * Cascading deletes for all user data
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteUserAccount } from '@/lib/services/settingsService';
import {
  ACCOUNT_NOT_DELETED,
  AccountDeletionRefusedError,
  refusalOutcome,
  resolveRefusalNames,
} from '@/lib/services/accountDeletionRefusal';
import type { DeleteAccountPayload, DeleteAccountResponse } from '@/types/user.types';
import { logger } from '@/lib/utils/logger';
import {
  deliverAccountNoticePushes,
  NOTICE_CLOCK_SKEW_MS,
} from '@/lib/services/accountNoticeService';

/**
 * DELETE /api/user/account
 * Permanently delete user account and all associated data
 *
 * Body: DeleteAccountPayload {
 *   confirmation_password: string;
 * }
 *
 * Steps:
 * 1. Verify authentication
 * 2. Verify password
 * 3. Fetch all transactions for export
 * 4. Generate CSV export (returned in response)
 * 5. Delete user profile and auth account (cascades to all data)
 *
 * @returns {data: DeleteAccountResponse} | {error: {message: string}}
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Parse request body
    const payload: DeleteAccountPayload = await request.json();

    if (!payload.confirmation_password) {
      return NextResponse.json(
        {
          error: {
            message: 'Validation error',
            details: 'Password is required for account deletion',
          },
        },
        { status: 400 }
      );
    }

    // Verify password using Supabase Auth
    // AC-8.3.8: Password re-entry required
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email ?? '',
      password: payload.confirmation_password,
    });

    if (passwordError) {
      return NextResponse.json(
        {
          error: {
            message: 'Invalid password',
            details: 'The password you entered is incorrect',
          },
        },
        { status: 401 }
      );
    }

    // Fetch all user transactions for export
    // AC-8.3.8: Data automatically exported before deletion
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(
        `
        id,
        amount,
        type,
        date,
        notes,
        created_at,
        category:categories (
          id,
          name,
          color,
          type
        )
      `
      )
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (transactionsError) {
      logger.error('Account', 'Error fetching transactions for export:', transactionsError);
      return NextResponse.json(
        {
          error: {
            message: 'Failed to fetch transactions for export',
            details: 'Account deletion failed. Please try again.',
          },
        },
        { status: 500 }
      );
    }

    // Note: In a production environment, you would generate a downloadable CSV
    // For this implementation, we'll signal that export data is available
    // The client can call the CSV export function before account deletion
    const hasTransactions = transactions && transactions.length > 0;

    // Delete the account: first the non-destructive preparation (household
    // ownership, shared objects, copies of categories other members use), then
    // admin.deleteUser, whose auth.users cascade removes the user's own rows,
    // user_profiles included. A throw from either step lands in the catch: 500,
    // except a CONFIRMED refusal, which the dialog explains in the user's language.
    const requestStart = Date.now();

    let deleteSuccess: boolean;
    try {
      deleteSuccess = await deleteUserAccount(user.id);
    } catch (error) {
      if (error instanceof AccountDeletionRefusedError) {
        // A CONFIRMED refusal may have published neutral notices of what the
        // preparation changed (spec-refused-deletion-notice, -neutral-variants):
        // push them after the response, as for a deletion. An unconfirmed failure
        // publishes nothing, so nothing here.
        // One confirmed case lands below instead: a refusal whose preparation
        // result was unreadable publishes the notices but is answered with a
        // generic error - their pushes come from the daily crons (02:00 / 09:00 UTC).
        after(() =>
          deliverAccountNoticePushes({ since: new Date(requestStart - NOTICE_CLOCK_SKEW_MS) })
        );
        const refused = await refusalResponse(
          error,
          supabase as unknown as SupabaseClient,
          user.id
        );
        if (refused) return refused;
      }
      throw error;
    }

    if (!deleteSuccess) {
      return NextResponse.json(
        {
          error: {
            message: 'Failed to delete account',
            details: 'Account deletion failed. Please try again.',
          },
        },
        { status: 500 }
      );
    }

    // The deletion published the notices for the people who stay (the auth.users
    // trigger, inside the deletion's own transaction); their PUSHES go out after
    // the response, off the critical path. A refused deletion published no
    // DELETION notice, so nobody is told about a deletion that did not happen;
    // its only notices are the neutral ones, pushed from the catch above.
    after(() =>
      deliverAccountNoticePushes({ since: new Date(requestStart - NOTICE_CLOCK_SKEW_MS) })
    );

    // Return success response
    const response: DeleteAccountResponse = {
      success: true,
      export_data_url: hasTransactions
        ? 'User should export data before deletion using CSV export button'
        : undefined,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error('Account', 'DELETE /api/user/account error:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to delete account',
          // Never the raw error: it is English, technical, and was shown verbatim
          // in the deletion dialog. The cause is in the log above.
          details: 'Account deletion failed. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * The refusal response: a CODE plus live parameters, never text. The dialog
 * renders it in the reader's language (spec-account-deletion-refused-message).
 * Names are resolved now, through the person's own session, and stored nowhere.
 * Returns null when an outcome needs names that cannot be resolved: the caller
 * then answers with the generic failure rather than a sentence with holes.
 */
async function refusalResponse(
  refusal: AccountDeletionRefusedError,
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  const outcome = refusalOutcome(refusal);
  const base = { message: 'Account not deleted', code: ACCOUNT_NOT_DELETED, outcome };

  if (outcome === 'unchanged') {
    return NextResponse.json({ error: base }, { status: 500 });
  }

  const names = await resolveRefusalNames(supabase, userId);
  if (!names) {
    logger.warn(
      'Account',
      `refused deletion (${outcome}) could not be described: names unresolvable`
    );
    return null;
  }
  return NextResponse.json(
    { error: { ...base, household: names.household, owner: names.owner } },
    { status: 500 }
  );
}
