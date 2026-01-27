#!/usr/bin/env tsx
/**
 * Action Item Status Update Helper
 * Updates status of retrospective action items in YAML tracking file
 *
 * Usage:
 *   tsx update-action-item-status.ts <item-id> <new-status> [epic-assigned] [story-id] [notes]
 *
 * Example:
 *   tsx update-action-item-status.ts epic6-high-2 in-progress 9 9-4-add-insight-engagement-analytics "Started implementation"
 *
 * Valid statuses: pending, in-progress, completed, deferred, obsolete
 */

import * as fs from 'fs';
import * as path from 'path';

// Import js-yaml using require (available as transitive dependency)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml');

// Valid status values as per AC-9.3.6
const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'deferred', 'obsolete'] as const;
type ActionItemStatus = typeof VALID_STATUSES[number];

interface ActionItem {
  id: string;
  priority: string;
  description: string;
  status: ActionItemStatus;
  epic_assigned: number | null;
  story_id: string | null;
  notes: string | null;
}

interface EpicActionItems {
  retrospective_date: string;
  action_items: ActionItem[];
}

interface ActionItemsData {
  [epicKey: string]: EpicActionItems;
}

/**
 * Main function to update action item status
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Error: Missing required arguments');
    console.log('\nUsage:');
    console.log('  tsx update-action-item-status.ts <item-id> <new-status> [epic-assigned] [story-id] [notes]');
    console.log('\nValid statuses:', VALID_STATUSES.join(', '));
    console.log('\nExample:');
    console.log('  tsx update-action-item-status.ts epic6-high-2 completed 9 9-4-add-insight-engagement-analytics "Completed in Epic 9"');
    process.exit(1);
  }

  const [itemId, newStatus, epicAssigned, storyId, notes] = args;

  // Validate status
  if (!VALID_STATUSES.includes(newStatus as ActionItemStatus)) {
    console.error(`❌ Error: Invalid status "${newStatus}"`);
    console.log(`Valid statuses: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }

  // Locate YAML file
  const yamlPath = path.join(process.cwd(), 'docs', 'sprint-artifacts', 'retrospective-action-items.yaml');

  if (!fs.existsSync(yamlPath)) {
    console.error(`❌ Error: Action items file not found at ${yamlPath}`);
    process.exit(1);
  }

  try {
    // Load existing YAML
    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    const data = yaml.load(fileContents) as ActionItemsData;

    // Find and update the action item
    let found = false;
    let epicKey: string | null = null;
    let itemIndex: number = -1;

    for (const [key, epicData] of Object.entries(data)) {
      if (!key.startsWith('epic-')) continue;

      const index = epicData.action_items.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        found = true;
        epicKey = key;
        itemIndex = index;
        break;
      }
    }

    if (!found || !epicKey) {
      console.error(`❌ Error: Action item "${itemId}" not found`);
      process.exit(1);
    }

    // Get the action item
    const item = data[epicKey].action_items[itemIndex];
    const oldStatus = item.status;

    // Update fields
    item.status = newStatus as ActionItemStatus;

    if (epicAssigned !== undefined) {
      item.epic_assigned = epicAssigned === 'null' ? null : parseInt(epicAssigned, 10);
    }

    if (storyId !== undefined) {
      item.story_id = storyId === 'null' ? null : storyId;
    }

    if (notes !== undefined) {
      item.notes = notes;
    }

    // Save updated YAML
    const updatedYaml = yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    fs.writeFileSync(yamlPath, updatedYaml, 'utf8');

    // Success output
    console.log('✅ Action item updated successfully!\n');
    console.log(`Item ID: ${itemId}`);
    console.log(`Status: ${oldStatus} → ${newStatus}`);

    if (item.epic_assigned !== null) {
      console.log(`Epic Assigned: ${item.epic_assigned}`);
    }

    if (item.story_id !== null) {
      console.log(`Story ID: ${item.story_id}`);
    }

    if (item.notes) {
      console.log(`Notes: ${item.notes}`);
    }

    console.log(`\n📄 File: ${yamlPath}`);
  } catch (error) {
    console.error('❌ Error updating action item:', error);
    process.exit(1);
  }
}

// Run main function
main();
