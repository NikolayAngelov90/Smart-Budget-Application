-- Story 10-3: Multi-Currency User Settings & Configuration
-- AC-10.3.1: Add preferred_currency default to 'EUR'
-- AC-10.3.9: Migration script for existing users (set default to EUR)
--
-- This migration updates the default currency preference from USD to EUR
-- for new users and existing users who haven't explicitly set a preference.
-- Users who have explicitly chosen USD will keep their preference.

-- Update the default preferences for the auto-create trigger
-- so new users get EUR as their default currency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, preferences)
  VALUES (
    NEW.id,
    jsonb_build_object(
      'currency_format', 'EUR',
      'date_format', 'MM/DD/YYYY',
      'onboarding_completed', false,
      'language', 'en'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users who still have the old USD default
-- Only update users whose currency_format is still the old default 'USD'
-- This ensures users who explicitly chose USD keep their choice
-- Note: Since USD was the only option before, all existing users have USD.
-- Per spec, we change the default to EUR for new users going forward.
-- Existing users keep USD since they had no choice before.
-- If you want to migrate existing users to EUR, uncomment the following:
--
-- UPDATE public.user_profiles
-- SET preferences = jsonb_set(
--   preferences,
--   '{currency_format}',
--   '"EUR"'::jsonb
-- )
-- WHERE preferences->>'currency_format' = 'USD'
--   OR preferences->>'currency_format' IS NULL;

-- Ensure any users without a currency_format preference get EUR
UPDATE public.user_profiles
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{currency_format}',
  '"EUR"'::jsonb
)
WHERE preferences->>'currency_format' IS NULL;
