-- Migration: 005_analytics_events_table.sql
-- Description: Create analytics_events table for tracking user engagement
-- Story: 9-4 Add Insight Engagement Analytics
-- Date: 2026-01-27

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_name TEXT NOT NULL,
    event_properties JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    session_id UUID,
    device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop'))
);

-- Create indexes for query performance
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_user_timestamp ON analytics_events(user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can INSERT their own events
CREATE POLICY "Users can insert own analytics events"
    ON analytics_events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can SELECT their own events
CREATE POLICY "Users can read own analytics events"
    ON analytics_events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Comment on table and columns for documentation
COMMENT ON TABLE analytics_events IS 'Stores user engagement analytics events (views, dismissals, exports)';
COMMENT ON COLUMN analytics_events.event_name IS 'Event type: insights_page_viewed, insight_viewed, insight_dismissed, etc.';
COMMENT ON COLUMN analytics_events.event_properties IS 'JSONB properties specific to event type (insight_id, insight_type, filter, etc.)';
COMMENT ON COLUMN analytics_events.session_id IS 'Client-generated UUID to group events by user session';
COMMENT ON COLUMN analytics_events.device_type IS 'Device category: mobile, tablet, or desktop';
