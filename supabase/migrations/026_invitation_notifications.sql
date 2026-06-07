-- Migration 026: Invitation delivery to existing users (Epic 13.2 follow-up)
-- The invitation flow was link-only — the invitee received nothing automatically.
-- This adds a server-side email→user_id lookup so the API can (a) push a notification
-- to an invitee who already has an account, and (b) the invitee sees a pending-invite
-- banner in-app (that query keys off the invitee's own session email, no lookup needed).
--
-- SECURITY: user_id_by_email reads auth.users, so it is restricted to the service_role
-- (the server's service-role client). EXECUTE is revoked from anon/authenticated to avoid
-- user-enumeration via the public RPC surface.
-- Date: 2026-06-05

CREATE OR REPLACE FUNCTION public.user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

-- Lock down: server (service_role) only — never callable by anon/authenticated clients.
REVOKE ALL ON FUNCTION public.user_id_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_id_by_email(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_id_by_email(TEXT) TO service_role;

COMMENT ON FUNCTION public.user_id_by_email(TEXT) IS 'Story 13.2 follow-up: resolve an email to its auth.users id for invite notifications. service_role only (no client enumeration).';
