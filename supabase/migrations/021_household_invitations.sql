-- Migration 021: Household invitations (Story 13.2)
-- Email-bound, single-use, 48h-expiry invitation tokens (ADR-016 / NFR12).
-- Date: 2026-06-04
--
-- RLS: SELECT-only, restricted to household admins via the recursion-safe
-- is_household_admin() SECURITY DEFINER helper (migration 020). There are NO
-- INSERT/UPDATE/DELETE policies — all writes go through the service-role-backed
-- invitationService (consistent with the Story 13.1 review: writes are server-side).

-- ============================================================================
-- ENUM
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL CHECK (char_length(trim(email)) > 0),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- written in Story 13.3
  accepted_at TIMESTAMP WITH TIME ZONE,                          -- written in Story 13.3
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- One active (pending) invite per email per household — the authoritative dedupe guard.
-- Indexed on lower(email) so case-variant addresses can't create duplicate pending
-- invites even via a path that skips the service's normalization (defense-in-depth).
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_active
  ON household_invitations (household_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_household ON household_invitations(household_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON household_invitations(email);

-- ============================================================================
-- ROW LEVEL SECURITY (admin SELECT only; writes are service-role)
-- ============================================================================

ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their household invitations" ON household_invitations;
CREATE POLICY "Admins can view their household invitations"
  ON household_invitations FOR SELECT
  USING (public.is_household_admin(household_id, auth.uid()));

-- No INSERT/UPDATE/DELETE policies by design — invitationService writes via the
-- service-role client (bypasses RLS). Story 13.3's accept flow validates the token
-- server-side; no invitee-facing direct-table policy is introduced here.

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE household_invitations IS 'Email-bound, single-use, 48h invitation tokens (Epic 13, ADR-016). Writes are service-role only.';
COMMENT ON COLUMN household_invitations.token IS 'Cryptographic single-use token (gen_random_uuid). Email-bound + expiry checked on accept (Story 13.3).';
