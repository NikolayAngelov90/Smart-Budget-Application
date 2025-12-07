-- ============================================================================
-- Migration: 003_insights_engagement_analytics
-- Purpose: Add engagement analytics columns to insights table for tracking user interactions
-- Epic: 6 Retrospective - Analytics Implementation
-- Date: 2025-12-07
-- ============================================================================

-- Add engagement tracking columns to insights table
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS metadata_expanded_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_metadata_expanded_at TIMESTAMP WITH TIME ZONE;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_insights_engagement ON insights(user_id, view_count, dismissed_at);

-- Add index for dismissed insights (for analytics)
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON insights(user_id, is_dismissed, dismissed_at);

-- Add comment for documentation
COMMENT ON COLUMN insights.view_count IS 'Number of times the insight was viewed by the user';
COMMENT ON COLUMN insights.first_viewed_at IS 'Timestamp when the insight was first viewed';
COMMENT ON COLUMN insights.last_viewed_at IS 'Timestamp when the insight was last viewed';
COMMENT ON COLUMN insights.dismissed_at IS 'Timestamp when the insight was dismissed';
COMMENT ON COLUMN insights.metadata_expanded_count IS 'Number of times the metadata section was expanded';
COMMENT ON COLUMN insights.last_metadata_expanded_at IS 'Timestamp when metadata was last expanded';

-- ============================================================================
-- Analytics Helper Function: Calculate Time to Dismiss
-- ============================================================================

CREATE OR REPLACE FUNCTION insights_time_to_dismiss(insight_row insights)
RETURNS INTERVAL AS $$
BEGIN
  IF insight_row.dismissed_at IS NULL OR insight_row.first_viewed_at IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN insight_row.dismissed_at - insight_row.first_viewed_at;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION insights_time_to_dismiss IS 'Calculates the time between first view and dismissal of an insight';

-- ============================================================================
-- Analytics Helper Function: Calculate Dismissal Rate per User
-- ============================================================================

CREATE OR REPLACE FUNCTION user_insight_dismissal_rate(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_insights INTEGER;
  dismissed_insights INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_insights
  FROM insights
  WHERE user_id = p_user_id;

  IF total_insights = 0 THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO dismissed_insights
  FROM insights
  WHERE user_id = p_user_id AND is_dismissed = true;

  RETURN ROUND((dismissed_insights::NUMERIC / total_insights::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION user_insight_dismissal_rate IS 'Calculates the percentage of insights dismissed by a user';

-- ============================================================================
-- Analytics Helper Function: Average Views Before Dismissal
-- ============================================================================

CREATE OR REPLACE FUNCTION avg_views_before_dismissal(p_user_id UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT AVG(view_count)
    FROM insights
    WHERE user_id = p_user_id AND is_dismissed = true AND view_count > 0
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION avg_views_before_dismissal IS 'Calculates average number of views before an insight is dismissed';

-- ============================================================================
-- Update existing dismissed insights with dismissed_at timestamp
-- (Backfill for existing data - assumes dismissed insights were dismissed when created)
-- ============================================================================

UPDATE insights
SET dismissed_at = created_at
WHERE is_dismissed = true AND dismissed_at IS NULL;
