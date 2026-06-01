-- Migration 016: Extend insight_type enum for Epic 12 pattern detection
-- Adds two new insight types for cross-category anomaly and trend detection.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block; Supabase
-- migrations run outside explicit transactions by default, so this is safe.

ALTER TYPE insight_type ADD VALUE IF NOT EXISTS 'spending_anomaly';
ALTER TYPE insight_type ADD VALUE IF NOT EXISTS 'new_high_spend_category';
