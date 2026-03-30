-- Migration 014: Add milestones_celebrated column to goals table
-- Story 11.6: Goal Milestone Celebrations
--
-- Adds persistent tracking of which milestone percentages have been celebrated
-- for each goal, so celebrations never re-trigger for the same threshold.

ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS milestones_celebrated INTEGER[]
NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.goals.milestones_celebrated IS
'Array of milestone percentages already celebrated (25, 50, 75, 100). Prevents re-triggering.';
