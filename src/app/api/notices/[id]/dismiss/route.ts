/**
 * POST /api/notices/[id]/dismiss - hides one of the signed-in person's account
 * notices for good (spec-account-deletion-notifications).
 *
 * Notices are server-written lifecycle rows, so clients have SELECT only. The
 * dismissal runs with the service role, scoped to the notice id AND the
 * caller as its recipient AND not yet dismissed. Idempotent. The answer is the
 * same for "already dismissed" and "not yours", so it tells nobody whether
 * someone else's notice exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: { message: 'Invalid notice id' } }, { status: 400 });
  }

  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from('account_notices')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', user.id)
    .is('dismissed_at', null)
    .select('id');
  if (error) {
    logger.error('Notices', `dismiss failed: ${error.message}`);
    return NextResponse.json({ error: { message: 'Failed to dismiss notice' } }, { status: 500 });
  }

  return NextResponse.json({ data: { dismissed: (data ?? []).length > 0 } });
}
