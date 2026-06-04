-- Migration 020: Households & membership foundation (Story 13.1)
-- Establishes household multi-tenancy (ADR-010) with dual-path RLS (ADR-015).
-- Date: 2026-06-03
--
-- RECURSION SAFETY: RLS policies on household_members must NOT self-reference the
-- household_members table in a subquery (Postgres raises 42P17 infinite recursion).
-- Membership/admin checks therefore go through SECURITY DEFINER helper functions,
-- which run with the function owner's rights and bypass RLS for the lookup.

-- ============================================================================
-- ENUM
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE household_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL CHECK (char_length(trim(name)) > 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role household_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (household_id, user_id)
);

-- ============================================================================
-- INDEXES (ADR-024)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_household_members_lookup ON household_members(household_id, user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_households_created_by ON households(created_by);

-- ============================================================================
-- SECURITY DEFINER HELPERS (break RLS recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(p_household_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (dual-path, ADR-015)
-- ============================================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- households: members read; admins mutate.
-- NO anon INSERT policy by design — household creation goes through the
-- service-role-backed API (householdService.createHousehold), which bypasses RLS.
-- A direct-client INSERT path would allow creating orphan households; not needed here.
DROP POLICY IF EXISTS "Members can view their household" ON households;
CREATE POLICY "Members can view their household"
  ON households FOR SELECT
  USING (public.is_household_member(id, auth.uid()));

-- Remove the previous direct-client INSERT policy if a prior migration created it.
DROP POLICY IF EXISTS "Users can create a household they own" ON households;

DROP POLICY IF EXISTS "Admins can update their household" ON households;
CREATE POLICY "Admins can update their household"
  ON households FOR UPDATE
  USING (public.is_household_admin(id, auth.uid()))
  WITH CHECK (public.is_household_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete their household" ON households;
CREATE POLICY "Admins can delete their household"
  ON households FOR DELETE
  USING (public.is_household_admin(id, auth.uid()));

-- household_members: co-members read.
-- NO anon INSERT policy by design. A blanket `WITH CHECK (user_id = auth.uid())`
-- would let any authenticated user insert THEMSELVES into ANY household_id (a
-- cross-household breach — they could self-join as admin and read all its data).
-- Memberships are created server-side via service-role: the creator's admin row
-- in createHousehold now, and an invitation-token-guarded join in Story 13.3.
DROP POLICY IF EXISTS "Members can view co-members" ON household_members;
CREATE POLICY "Members can view co-members"
  ON household_members FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()));

-- Remove the previous over-permissive self-join policy if a prior migration created it.
DROP POLICY IF EXISTS "Users can join as themselves" ON household_members;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE households IS 'Household groups for shared budgeting (Epic 13, ADR-010).';
COMMENT ON TABLE household_members IS 'Membership + role per household. One household per user in MVP (enforced in service).';
COMMENT ON FUNCTION public.is_household_member(UUID, UUID) IS 'Recursion-safe membership check for RLS (SECURITY DEFINER bypasses RLS).';
COMMENT ON FUNCTION public.is_household_admin(UUID, UUID) IS 'Recursion-safe admin check for RLS (SECURITY DEFINER bypasses RLS).';
