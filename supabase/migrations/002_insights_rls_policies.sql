-- Migration: Add missing RLS policies for insights table
-- Story: 6.1 - AI Insights Rules Engine Implementation
-- Date: 2025-01-15

-- Add INSERT policy for insights (server-side generation)
-- Note: This allows backend services to generate insights for users
CREATE POLICY "Service can insert insights for users"
  ON insights FOR INSERT
  WITH CHECK (true); -- Server-side service with service role bypasses RLS anyway

-- Add DELETE policy for insights
-- Allows users or services to delete insights (for regeneration)
CREATE POLICY "Users and services can delete insights"
  ON insights FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() IS NULL); -- IS NULL allows service role
