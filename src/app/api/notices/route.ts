/**
 * GET /api/notices - the signed-in person's undismissed account notices
 * (spec-account-deletion-notifications).
 *
 * Read through the person's OWN session, so RLS ("own notices are readable")
 * decides what comes back. A notice holds a kind, a cause and non-personal
 * params; the client renders the text in the UI language.
 *
 * Degradation (docs/api-conventions.md#Error-Handling): the notices ARE the
 * response, so a query error is a 500, never an empty list. An empty list would
 * be cached by the SWR localStorage provider and hide real notices.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import type { AccountNotice } from '@/lib/accountNotices/noticeMessage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  // account_notices is not in the generated Database types: the generic client.
  const { data, error } = await (supabase as unknown as SupabaseClient)
    .from('account_notices')
    .select('id, kind, cause, household_id, params, created_at')
    .eq('recipient_id', user.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('Notices', `GET failed: ${error.message}`);
    return NextResponse.json({ error: { message: 'Failed to load notices' } }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as AccountNotice[] });
}
