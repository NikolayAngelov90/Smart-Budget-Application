-- Engagement tracking has never written a row in production. Not once, on any
-- insight, since Epic 6 shipped the endpoint.
--
-- The route (POST /api/insights/:id/track) uses the USER client, so column
-- privileges apply — and `authenticated` was never granted UPDATE on the five
-- engagement columns. Verified against production BEFORE writing this:
--
--   SELECT has_column_privilege('authenticated','public.insights',c,'UPDATE')
--   -> false  for view_count, first_viewed_at, last_viewed_at,
--             metadata_expanded_count, last_metadata_expanded_at
--   -> true   for is_dismissed, dismissed_at
--
-- `authenticated` holds NO table-level UPDATE on public.insights — exactly two
-- column grants, added by the hp-10 migration. RLS was never the blocker: the
-- policy "Users can update their own insights" allows the row and carries no
-- WITH CHECK, so the privileges and the policy had to be checked separately to
-- see which one actually said no.
--
-- Every track call would have been rejected with 42501. Telemetry fails
-- silently by design, so nothing would ever have surfaced it — the client was
-- never wired either, which is why the two faults hid each other: wiring the
-- client alone would have produced the same empty table and looked like "users
-- do not engage".
--
-- FORGEABILITY — ACCEPTED DELIBERATELY. A column grant lets a user write these
-- values through PostgREST directly, not only via the route, so a user can
-- inflate their own counters. That trade is already accepted for
-- (is_dismissed, dismissed_at): the data is the user's own, RLS confines it to
-- their rows, and no access-control decision depends on it. The alternative,
-- service-role writes, would place a path that bypasses RLS within reach of a
-- client request, which is strictly worse for a counter.
--
-- NOTE FOR WHOEVER READS THE ENGAGEMENT NUMBERS: data before this migration is
-- absent because nothing could record it, NOT because nobody engaged. Those two
-- read identically in a query and mean opposite things.

GRANT UPDATE (
  view_count,
  first_viewed_at,
  last_viewed_at,
  metadata_expanded_count,
  last_metadata_expanded_at
) ON public.insights TO authenticated;
