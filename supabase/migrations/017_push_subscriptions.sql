-- Migration 017: Push subscription storage for Web Push API (Story 12.3)
-- Stores per-device Web Push endpoints so the server can dispatch notifications
-- when the user is not in an active browser session.

CREATE TABLE push_subscriptions (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint  TEXT        NOT NULL,
  p256dh    TEXT        NOT NULL,  -- public key for payload encryption
  auth      TEXT        NOT NULL,  -- auth secret for payload encryption
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)       -- one row per device per user
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
