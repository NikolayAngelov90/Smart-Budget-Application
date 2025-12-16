--
-- Story 8.3: Settings Page and Account Management
-- Migration: Create user_profiles table
--
-- AC-8.3.2: Store user profile data (display_name, profile_picture_url)
-- AC-8.3.5: Store user preferences (currency_format, date_format, onboarding_completed)
--

-- Create user_profiles table
-- Extends auth.users with additional profile information
CREATE TABLE IF NOT EXISTS user_profiles (
  -- Primary key and foreign key to auth.users
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile information (AC-8.3.2)
  display_name TEXT,
  profile_picture_url TEXT,

  -- User preferences stored as JSONB (AC-8.3.5)
  -- Allows future expansion without schema changes
  preferences JSONB NOT NULL DEFAULT '{
    "currency_format": "USD",
    "date_format": "MM/DD/YYYY",
    "onboarding_completed": false
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);

-- Enable Row Level Security (RLS)
-- AC-8.3: Users can only access their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can SELECT their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Users can INSERT their own profile (for new signups)
CREATE POLICY "Users can create their own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can UPDATE their own profile
-- AC-8.3.6: Profile changes with optimistic UI
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can DELETE their own profile (for account deletion)
-- AC-8.3.8: Account deletion flow
CREATE POLICY "Users can delete their own profile"
  ON user_profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Create updated_at trigger
-- Automatically update updated_at timestamp on profile changes
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Create function to initialize user profile on signup
-- Called automatically after new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default user profile
  INSERT INTO user_profiles (id, preferences)
  VALUES (
    NEW.id,
    '{
      "currency_format": "USD",
      "date_format": "MM/DD/YYYY",
      "onboarding_completed": false
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Comment on table and columns for documentation
COMMENT ON TABLE user_profiles IS 'User profile information extending auth.users - Story 8.3';
COMMENT ON COLUMN user_profiles.id IS 'User ID (FK to auth.users)';
COMMENT ON COLUMN user_profiles.display_name IS 'User display name (editable)';
COMMENT ON COLUMN user_profiles.profile_picture_url IS 'Profile picture URL (social login or uploaded)';
COMMENT ON COLUMN user_profiles.preferences IS 'User preferences as JSONB (currency, date format, onboarding)';
COMMENT ON COLUMN user_profiles.created_at IS 'Profile creation timestamp';
COMMENT ON COLUMN user_profiles.updated_at IS 'Last profile update timestamp (auto-updated)';
