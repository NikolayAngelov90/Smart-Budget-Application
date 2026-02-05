-- Migration: 006_user_sessions_table.sql
-- Description: Create user_sessions table for device session management
-- Story: 9-6 Complete Device Session Management (AC-8.4.5)
-- Date: 2026-02-04

-- Create device_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE device_type AS ENUM ('mobile', 'tablet', 'desktop');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create user_sessions table (AC-9.6.1)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT NOT NULL,
    device_name TEXT NOT NULL DEFAULT 'Unknown Device',
    device_type device_type NOT NULL DEFAULT 'desktop',
    browser TEXT,
    ip_address TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(session_token)
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(user_id, last_active DESC);

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can SELECT their own sessions
CREATE POLICY "Users can view own sessions"
    ON user_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policy: Users can INSERT their own sessions
CREATE POLICY "Users can insert own sessions"
    ON user_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can UPDATE their own sessions (device_name, last_active)
CREATE POLICY "Users can update own sessions"
    ON user_sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policy: Users can DELETE their own sessions (revoke)
CREATE POLICY "Users can delete own sessions"
    ON user_sessions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Function to generate default device name from user agent
CREATE OR REPLACE FUNCTION generate_device_name(user_agent TEXT)
RETURNS TEXT AS $$
DECLARE
    device_name TEXT := 'Unknown Device';
    ua_lower TEXT;
BEGIN
    IF user_agent IS NULL OR user_agent = '' THEN
        RETURN device_name;
    END IF;

    ua_lower := LOWER(user_agent);

    -- Detect browser
    IF ua_lower LIKE '%chrome%' AND ua_lower NOT LIKE '%edge%' THEN
        device_name := 'Chrome';
    ELSIF ua_lower LIKE '%firefox%' THEN
        device_name := 'Firefox';
    ELSIF ua_lower LIKE '%safari%' AND ua_lower NOT LIKE '%chrome%' THEN
        device_name := 'Safari';
    ELSIF ua_lower LIKE '%edge%' THEN
        device_name := 'Edge';
    ELSIF ua_lower LIKE '%opera%' THEN
        device_name := 'Opera';
    ELSE
        device_name := 'Browser';
    END IF;

    -- Detect OS and append
    IF ua_lower LIKE '%iphone%' THEN
        device_name := device_name || ' on iPhone';
    ELSIF ua_lower LIKE '%ipad%' THEN
        device_name := device_name || ' on iPad';
    ELSIF ua_lower LIKE '%android%' AND ua_lower LIKE '%mobile%' THEN
        device_name := device_name || ' on Android Phone';
    ELSIF ua_lower LIKE '%android%' THEN
        device_name := device_name || ' on Android Tablet';
    ELSIF ua_lower LIKE '%macintosh%' OR ua_lower LIKE '%mac os%' THEN
        device_name := device_name || ' on Mac';
    ELSIF ua_lower LIKE '%windows%' THEN
        device_name := device_name || ' on Windows';
    ELSIF ua_lower LIKE '%linux%' THEN
        device_name := device_name || ' on Linux';
    END IF;

    RETURN device_name;
END;
$$ LANGUAGE plpgsql;

-- Function to detect device type from user agent
CREATE OR REPLACE FUNCTION detect_device_type(user_agent TEXT)
RETURNS device_type AS $$
DECLARE
    ua_lower TEXT;
BEGIN
    IF user_agent IS NULL OR user_agent = '' THEN
        RETURN 'desktop'::device_type;
    END IF;

    ua_lower := LOWER(user_agent);

    -- Check for tablets first (they often include 'mobile' in UA)
    IF ua_lower LIKE '%ipad%' OR (ua_lower LIKE '%android%' AND ua_lower NOT LIKE '%mobile%') THEN
        RETURN 'tablet'::device_type;
    END IF;

    -- Check for mobile devices
    IF ua_lower LIKE '%mobile%' OR ua_lower LIKE '%iphone%' OR ua_lower LIKE '%ipod%' THEN
        RETURN 'mobile'::device_type;
    END IF;

    RETURN 'desktop'::device_type;
END;
$$ LANGUAGE plpgsql;

-- Function to detect browser from user agent
CREATE OR REPLACE FUNCTION detect_browser(user_agent TEXT)
RETURNS TEXT AS $$
DECLARE
    ua_lower TEXT;
BEGIN
    IF user_agent IS NULL OR user_agent = '' THEN
        RETURN 'Unknown';
    END IF;

    ua_lower := LOWER(user_agent);

    IF ua_lower LIKE '%edge%' THEN
        RETURN 'Edge';
    ELSIF ua_lower LIKE '%chrome%' AND ua_lower NOT LIKE '%chromium%' THEN
        RETURN 'Chrome';
    ELSIF ua_lower LIKE '%firefox%' THEN
        RETURN 'Firefox';
    ELSIF ua_lower LIKE '%safari%' AND ua_lower NOT LIKE '%chrome%' THEN
        RETURN 'Safari';
    ELSIF ua_lower LIKE '%opera%' OR ua_lower LIKE '%opr%' THEN
        RETURN 'Opera';
    ELSE
        RETURN 'Unknown';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for user_sessions table (AC-9.6.8)
ALTER PUBLICATION supabase_realtime ADD TABLE user_sessions;

-- Comment on table and columns for documentation
COMMENT ON TABLE user_sessions IS 'Active user device sessions for multi-device management';
COMMENT ON COLUMN user_sessions.device_name IS 'User-editable device name for identification';
COMMENT ON COLUMN user_sessions.device_type IS 'Device category: mobile, tablet, or desktop';
COMMENT ON COLUMN user_sessions.browser IS 'Browser name detected from user agent';
COMMENT ON COLUMN user_sessions.last_active IS 'Timestamp of last activity on this session';
COMMENT ON COLUMN user_sessions.session_token IS 'Unique session identifier from auth';
