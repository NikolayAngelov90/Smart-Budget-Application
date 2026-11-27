#!/usr/bin/env bash
# =============================================================================
# Account-notice health: are there CONTAINED notice failures nobody has read?
# =============================================================================
# A notice failure never fails or rolls back an account deletion or a member's
# removal (supabase/migrations/20261125100000_account_notices.sql). Each one is
# contained instead, and leaves a marker row in private.account_notice_failures
# that commits WITH the deletion. A marker nobody reads is a silent catch with
# extra steps, so this reads them: counts only, through
# public.account_notice_failure_summary(), which is all schema_reader may
# execute beyond the catalog.
#
# Run nightly by .github/workflows/account-notice-health.yml. Connection: the
# standard libpq environment (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE,
# PGSSLMODE); nothing is passed on the command line.
#
# Exit 0: none unacknowledged.
# Exit 1: some, one line per cause:
#           `  FAILED stage|kind|sqlstate x<count> last <time> UTC`
#         The watchdog's signature is built from those lines, count and last
#         time INCLUDED: they change only when a new failure is recorded (the
#         summary counts unacknowledged rows only), so every new lost notice
#         changes the signature and reopens the issue - even a silenced one.
# Exit 2: the log could not be read. That is NOT "none", and must never pass.
set -euo pipefail

QUERY=$(cat <<'SQL'
SELECT stage, coalesce(kind, '-'), coalesce(sqlstate, '-'), failures,
       to_char(first_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'),
       to_char(last_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
  FROM public.account_notice_failure_summary()
SQL
)

if ! ROWS=$(psql -X -A -t -F '|' -v ON_ERROR_STOP=1 -c "$QUERY"); then
  echo "COULD NOT READ the account-notice failure log (the error is above)."
  echo "This is NOT 'no failures': an unreadable log must never pass."
  exit 2
fi

if [ -z "$ROWS" ]; then
  echo "ok: no unacknowledged account-notice failures"
  exit 0
fi

echo "ACCOUNT NOTICE FAILURES - unacknowledged, one line per cause (stage|kind|sqlstate):"
printf '%s\n' "$ROWS" | while IFS='|' read -r stage kind state n first last; do
  echo "  FAILED ${stage}|${kind}|${state} x${n} last ${last} UTC"
  echo "      first ${first} UTC"
done
cat <<'TXT'

Each one was CONTAINED; what it means depends on the stage:
  'publish' - the auth.users trigger: the deletion completed and a notice for a
              person who stays was lost.
  'stage'   - a deletion's preparation: that notice was never staged.
  'write'   - a member's removal: the removal completed, that notice was lost.
  'refusal' - a REFUSED deletion: the deletion did NOT happen, and someone it
              changed something for was not told neutrally. The kind is the
              NEUTRAL notice that was not written - household_now_yours,
              shared_plans_now_yours, shared_category_renamed or
              category_copies_made, for a staged household_transferred,
              shared_plans_received, category_renamed or categories_copied.
              That staged notice still stands and is told if that person's
              deletion later succeeds.
              55P03 WITH a kind: a row it needed (the household, a member, a
              category, or the staged notice) was locked by someone else for
              over 1 s. NO kind means nothing was told: 55P03 - that person's
              own deletion was most likely in flight and told everyone itself;
              42P01 - the staged notices could not be read at all.
Read them in the Supabase SQL editor:
  SELECT * FROM private.account_notice_failures
   WHERE acknowledged_at IS NULL ORDER BY created_at;
The full error is in the Postgres log, as a WARNING at the same moment.
Once read and dealt with, acknowledge EXACTLY the rows you read - by id, or by
the created_at of the newest one you read - so a failure that arrived after
you looked is not swept up unread:
  UPDATE private.account_notice_failures SET acknowledged_at = now()
   WHERE acknowledged_at IS NULL AND created_at <= '<newest created_at you read>';
TXT
exit 1
