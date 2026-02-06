#!/usr/bin/env node

/**
 * Infrastructure Percentage Checker
 * Story 9-10: Formalize 20% Infrastructure Time Rule (AC-9.10.5, AC-9.10.6)
 *
 * Validates infrastructure time allocation from sprint-status.yaml.
 * Used during retrospectives and epic planning.
 *
 * Usage: node scripts/check-infra-percentage.js [epic-key]
 * Exit code: 0 (healthy range) or 1 (outside range)
 */

const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  WARNING_LOW: 15,
  TARGET: 20,
  WARNING_HIGH: 30,
};

/**
 * Parse the infrastructure_tracking section from sprint-status.yaml
 * Simple YAML parser for the known structure (no external dependency needed)
 */
function parseInfraTracking(yamlContent) {
  const tracking = {};
  const lines = yamlContent.split('\n');
  let inInfraSection = false;
  let currentEpic = null;
  let currentField = null;
  let currentList = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Detect infrastructure_tracking section
    if (trimmed === 'infrastructure_tracking:') {
      inInfraSection = true;
      continue;
    }

    if (!inInfraSection) continue;

    // End of infrastructure_tracking section (unindented non-empty line)
    if (trimmed.length > 0 && !trimmed.startsWith(' ') && !trimmed.startsWith('#')) {
      break;
    }

    // Skip empty lines and comments
    if (trimmed.length === 0 || trimmed.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    // Epic key (2-space indent)
    if (indent === 2 && trimmed.trim().endsWith(':') && !trimmed.trim().startsWith('-')) {
      const epicKey = trimmed.trim().replace(':', '');
      currentEpic = epicKey;
      tracking[epicKey] = {
        total_stories: 0,
        infrastructure_stories: [],
        feature_stories: [],
        infrastructure_percentage: 0,
        status: '',
        notes: '',
      };
      currentField = null;
      currentList = null;
      continue;
    }

    if (!currentEpic) continue;

    const content = trimmed.trim();

    // Field with value (4-space indent)
    if (indent === 4 && content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = content.substring(0, colonIdx).trim();
      const value = content.substring(colonIdx + 1).trim();

      if (key === 'total_stories') {
        tracking[currentEpic].total_stories = parseInt(value) || 0;
        currentField = null;
        currentList = null;
      } else if (key === 'infrastructure_percentage') {
        tracking[currentEpic].infrastructure_percentage = parseInt(value) || 0;
        currentField = null;
        currentList = null;
      } else if (key === 'status') {
        tracking[currentEpic].status = value;
        currentField = null;
        currentList = null;
      } else if (key === 'notes') {
        tracking[currentEpic].notes = value.replace(/^"(.*)"$/, '$1');
        currentField = null;
        currentList = null;
      } else if (key === 'infrastructure_stories' || key === 'feature_stories') {
        if (value === '[]') {
          tracking[currentEpic][key] = [];
          currentField = null;
          currentList = null;
        } else {
          currentField = key;
          currentList = key;
        }
      }
      continue;
    }

    // List item (6-space indent, starts with -)
    if (indent === 6 && content.startsWith('-') && currentList && currentEpic) {
      const item = content.replace(/^-\s*/, '').trim();
      tracking[currentEpic][currentList].push(item);
    }
  }

  return tracking;
}

/**
 * Calculate infrastructure percentage for an epic
 */
function calculatePercentage(infraCount, totalCount) {
  if (totalCount === 0) return 0;
  return Math.round((infraCount / totalCount) * 100);
}

/**
 * Get status label based on percentage
 */
function getStatus(percentage) {
  if (percentage < THRESHOLDS.WARNING_LOW) return 'below_target';
  if (percentage > THRESHOLDS.WARNING_HIGH) return 'above_target';
  return 'on_target';
}

/**
 * Validate infrastructure tracking for a specific epic or all epics
 */
function validateInfraPercentage(epicKey) {
  const yamlPath = path.join(process.cwd(), 'docs', 'sprint-artifacts', 'sprint-status.yaml');

  if (!fs.existsSync(yamlPath)) {
    console.error('[FAIL] sprint-status.yaml not found');
    return { success: false, results: [] };
  }

  const content = fs.readFileSync(yamlPath, 'utf-8');
  const tracking = parseInfraTracking(content);

  if (Object.keys(tracking).length === 0) {
    console.log('[WARN] No infrastructure_tracking section found in sprint-status.yaml');
    return { success: true, results: [] };
  }

  const results = [];
  const epicsToCheck = epicKey ? [epicKey] : Object.keys(tracking);
  let allHealthy = true;

  for (const epic of epicsToCheck) {
    const data = tracking[epic];
    if (!data) {
      console.log(`[WARN] Epic "${epic}" not found in infrastructure_tracking`);
      continue;
    }

    const infraCount = data.infrastructure_stories.length;
    const featureCount = data.feature_stories.length;
    const total = data.total_stories || (infraCount + featureCount);
    const percentage = calculatePercentage(infraCount, total);
    const status = getStatus(percentage);

    const result = {
      epic,
      infraCount,
      featureCount,
      total,
      percentage,
      status,
      notes: data.notes,
    };
    results.push(result);

    if (status === 'below_target') {
      allHealthy = false;
    }
  }

  return { success: allHealthy, results };
}

// Run if executed directly
if (require.main === module) {
  const epicArg = process.argv[2];

  console.log('\nInfrastructure Time Allocation Check');
  console.log('='.repeat(40));

  const { success, results } = validateInfraPercentage(epicArg);

  for (const r of results) {
    const icon = r.status === 'on_target' ? '[PASS]' :
                 r.status === 'above_target' ? '[WARN]' : '[FAIL]';

    console.log(`\n  ${icon} ${r.epic}`);
    console.log(`        Infrastructure: ${r.infraCount}/${r.total} stories (${r.percentage}%)`);
    console.log(`        Target: ${THRESHOLDS.TARGET}% (range: ${THRESHOLDS.WARNING_LOW}-${THRESHOLDS.WARNING_HIGH}%)`);

    if (r.status === 'below_target') {
      console.log(`        WARNING: Infrastructure time only ${r.percentage}% - risk of tech debt accumulation`);
    } else if (r.status === 'above_target') {
      console.log(`        NOTE: Infrastructure time ${r.percentage}% - above target (may delay features)`);
    } else {
      console.log(`        Status: Within healthy range`);
    }

    if (r.notes) {
      console.log(`        Notes: ${r.notes}`);
    }
  }

  console.log('\n' + '='.repeat(40));

  if (results.length === 0) {
    console.log('  No infrastructure tracking data found.');
    process.exit(0);
  }

  if (success) {
    console.log('  [PASS] Infrastructure allocation healthy');
    process.exit(0);
  } else {
    console.log('  [FAIL] Infrastructure allocation below target');
    process.exit(1);
  }
}

module.exports = {
  parseInfraTracking,
  calculatePercentage,
  getStatus,
  validateInfraPercentage,
  THRESHOLDS,
};
