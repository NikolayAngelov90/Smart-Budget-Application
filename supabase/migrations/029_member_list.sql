-- Migration 029: Household member list for admin management (Story 13.11)
-- Member removal itself needs NO schema change — it's a DELETE of the household_members row,
-- and RLS does the revocation (the ex-member fails every is_household_member() gate). This
-- migration only adds a membership-gated way to list members WITH their emails (joined from
-- auth.users) so the admin UI can choose who to remove.
-- Date: 2026-06-07

CREATE OR REPLACE FUNCTION public.household_members_list(p_household_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, role household_role, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_household_member(p_household_id, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT hm.user_id, u.email::text, hm.role, hm.joined_at
    FROM household_members hm
    JOIN auth.users u ON u.id = hm.user_id
    WHERE hm.household_id = p_household_id
    ORDER BY hm.joined_at ASC;
END;
$$;

COMMENT ON FUNCTION public.household_members_list(UUID) IS 'Story 13.11: membership-gated member roster (user_id, email, role, joined_at) for the admin management UI.';
