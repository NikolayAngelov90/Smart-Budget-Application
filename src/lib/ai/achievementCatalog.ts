/**
 * Achievement Catalog — Story 15.3 (FR30)
 *
 * The definitive, ordered list of achievements. Definitions live in CODE
 * (documented ADR-012 deviation): unlock conditions are code regardless, and
 * names/conditions ship through the CI-enforced en/bg i18n pipeline
 * (`achievements.names.<key>` / `achievements.conditions.<key>`).
 *
 * Every achievement ties to real financial behavior (UX anti-pattern list
 * forbids badges without financial meaning). Thresholds live in the engine.
 */

import type { AchievementKey } from '@/types/database.types';

/** Catalog order = display order in the gallery and evaluation order */
export const ACHIEVEMENTS: ReadonlyArray<{ key: AchievementKey }> = [
  { key: 'first_transaction' },
  { key: 'ten_transactions' },
  { key: 'hundred_transactions' },
  { key: 'week_streak' },
  { key: 'month_streak' },
  { key: 'first_budget' },
  { key: 'first_goal' },
  { key: 'goal_reached' },
  { key: 'score_steady' },
  { key: 'score_master' },
  { key: 'comeback' },
];

/** Fast validation set for service-layer key checks */
export const ACHIEVEMENT_KEYS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.key));
