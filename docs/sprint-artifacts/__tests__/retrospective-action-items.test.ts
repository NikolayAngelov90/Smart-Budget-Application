/**
 * Retrospective Action Items YAML Validation Tests
 * Tests AC-9.3.1, AC-9.3.5, AC-9.3.6, AC-9.3.7
 */

import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml');

const YAML_PATH = path.join(__dirname, '..', 'retrospective-action-items.yaml');
const SPRINT_STATUS_PATH = path.join(__dirname, '..', 'sprint-status.yaml');

// Type definitions
interface ActionItem {
  id: string;
  priority: string;
  description: string;
  status: string;
  epic_assigned: number | null;
  story_id: string | null;
  notes?: string | null;
}

interface EpicData {
  retrospective_date: string | Date;
  action_items: ActionItem[];
}

interface YAMLData {
  [key: string]: EpicData;
}

// Helper function to get all action items from YAML data
function getAllActionItems(data: YAMLData): ActionItem[] {
  return Object.values(data)
    .filter((value): value is EpicData =>
      typeof value === 'object' &&
      value !== null &&
      'action_items' in value
    )
    .flatMap((epicData) => epicData.action_items);
}

describe('Retrospective Action Items YAML', () => {
  describe('AC-9.3.1: YAML Schema Creation', () => {
    test('YAML file exists at expected location', () => {
      expect(fs.existsSync(YAML_PATH)).toBe(true);
    });

    test('YAML file parses without errors', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      expect(() => yaml.load(fileContents)).not.toThrow();
    });

    test('YAML contains epic entries', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
      expect(Object.keys(data).some((key) => key.startsWith('epic-'))).toBe(true);
    });

    test('each epic entry has required fields', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const epicKeys = Object.keys(data).filter((key) => key.startsWith('epic-'));

      epicKeys.forEach((epicKey) => {
        const epicData = data[epicKey];
        expect(epicData).toHaveProperty('retrospective_date');
        expect(epicData).toHaveProperty('action_items');
        expect(Array.isArray(epicData.action_items)).toBe(true);
      });
    });

    test('each action item has all required fields', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const epicKeys = Object.keys(data).filter((key) => key.startsWith('epic-'));

      epicKeys.forEach((epicKey) => {
        const epicData = data[epicKey];
        epicData.action_items.forEach((item: unknown) => {
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('priority');
          expect(item).toHaveProperty('description');
          expect(item).toHaveProperty('status');
          expect(item).toHaveProperty('epic_assigned');
          expect(item).toHaveProperty('story_id');
        });
      });
    });
  });

  describe('AC-9.3.5: Backfill Historical Data', () => {
    test('Epic 6 action items are present', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      expect(data['epic-6']).toBeDefined();
      expect(data['epic-6'].action_items).toBeDefined();
      expect(data['epic-6'].action_items.length).toBeGreaterThanOrEqual(7);
    });

    test('Epic 8 action items are present', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      expect(data['epic-8']).toBeDefined();
      expect(data['epic-8'].action_items).toBeDefined();
      expect(data['epic-8'].action_items.length).toBeGreaterThanOrEqual(10);
    });

    test('Epic 6 has correct retrospective date', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const date = data['epic-6'].retrospective_date;
      // YAML may parse as Date object or string
      const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
      expect(dateStr).toBe('2025-12-07');
    });

    test('Epic 8 has correct retrospective date', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const date = data['epic-8'].retrospective_date;
      // YAML may parse as Date object or string
      const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
      expect(dateStr).toBe('2026-01-06');
    });

    test('Epic 6 HIGH priority items are backfilled', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const highItems = data['epic-6'].action_items.filter(
        (item: { priority: string }) => item.priority === 'HIGH'
      );

      expect(highItems.length).toBeGreaterThanOrEqual(2);
      expect(highItems.some((item: { description: string }) =>
        item.description.includes('rate limiting')
      )).toBe(true);
      expect(highItems.some((item: { description: string }) =>
        item.description.includes('analytics')
      )).toBe(true);
    });

    test('Epic 8 CRITICAL priority item is backfilled', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const criticalItems = data['epic-8'].action_items.filter(
        (item: { priority: string }) => item.priority === 'CRITICAL'
      );

      expect(criticalItems.length).toBeGreaterThanOrEqual(1);
      expect(criticalItems.some((item: { description: string }) =>
        item.description.includes('test utilities')
      )).toBe(true);
    });

    test('completed items have story_id populated', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      const completedItems = allItems.filter((item: { status: string }) => item.status === 'completed');

      completedItems.forEach((item: { story_id: string | null }) => {
        expect(item.story_id).not.toBeNull();
        expect(typeof item.story_id).toBe('string');
      });
    });
  });

  describe('AC-9.3.6: Status Tracking', () => {
    const VALID_STATUSES = ['pending', 'in-progress', 'completed', 'deferred', 'obsolete'];

    test('all action items have valid status values', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { status: string; id: string }) => {
        expect(VALID_STATUSES).toContain(item.status);
      });
    });

    test('status values are lowercase with hyphens', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { status: string }) => {
        expect(item.status).toMatch(/^[a-z-]+$/);
      });
    });

    test('completed and in-progress items should have epic_assigned', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      const activeItems = allItems.filter((item: { status: string }) =>
        ['completed', 'in-progress'].includes(item.status)
      );

      activeItems.forEach((item: { epic_assigned: number | null; id: string }) => {
        expect(item.epic_assigned).not.toBeNull();
        expect(typeof item.epic_assigned).toBe('number');
      });
    });
  });

  describe('AC-9.3.7: Cross-Reference Validation', () => {
    test('sprint-status.yaml file exists', () => {
      expect(fs.existsSync(SPRINT_STATUS_PATH)).toBe(true);
    });

    test('epic_assigned values exist in sprint-status.yaml', () => {
      const actionItemsContents = fs.readFileSync(YAML_PATH, 'utf8');
      const actionItemsData = yaml.load(actionItemsContents) as YAMLData;

      const sprintStatusContents = fs.readFileSync(SPRINT_STATUS_PATH, 'utf8');
      const sprintStatusData = yaml.load(sprintStatusContents) as { development_status: Record<string, string> };

      const allItems = getAllActionItems(actionItemsData);

      const itemsWithEpicAssigned = allItems.filter(
        (item) => item.epic_assigned !== null
      );

      itemsWithEpicAssigned.forEach((item) => {
        const epicKey = `epic-${item.epic_assigned}`;
        expect(sprintStatusData.development_status).toHaveProperty(epicKey);
      });
    });

    test('story_id values exist in sprint-status.yaml', () => {
      const actionItemsContents = fs.readFileSync(YAML_PATH, 'utf8');
      const actionItemsData = yaml.load(actionItemsContents) as YAMLData;

      const sprintStatusContents = fs.readFileSync(SPRINT_STATUS_PATH, 'utf8');
      const sprintStatusData = yaml.load(sprintStatusContents) as { development_status: Record<string, string> };

      const allItems = getAllActionItems(actionItemsData);

      const itemsWithStoryId = allItems.filter(
        (item) => item.story_id !== null
      );

      itemsWithStoryId.forEach((item) => {
        expect(sprintStatusData.development_status).toHaveProperty(item.story_id as string);
      });
    });

    test('action item IDs follow format epic{N}-{priority}-{index}', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { id: string }) => {
        expect(item.id).toMatch(/^epic\d+-(critical|high|medium|low)-\d+$/);
      });
    });

    test('action item IDs are unique across all epics', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      const ids = allItems.map((item: { id: string }) => item.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('Priority Levels', () => {
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    test('all action items have valid priority values', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { priority: string; id: string }) => {
        expect(VALID_PRIORITIES).toContain(item.priority);
      });
    });

    test('priority values are uppercase', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { priority: string }) => {
        expect(item.priority).toBe(item.priority.toUpperCase());
      });
    });
  });

  describe('Data Quality', () => {
    test('all descriptions are non-empty strings', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { description: string; id: string }) => {
        expect(typeof item.description).toBe('string');
        expect(item.description.length).toBeGreaterThan(0);
      });
    });

    test('epic_assigned is either number or null', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { epic_assigned: number | null; id: string }) => {
        expect(item.epic_assigned === null || typeof item.epic_assigned === 'number').toBe(true);
      });
    });

    test('story_id is either string or null', () => {
      const fileContents = fs.readFileSync(YAML_PATH, 'utf8');
      const data = yaml.load(fileContents) as YAMLData;

      const allItems = getAllActionItems(data);

      allItems.forEach((item: { story_id: string | null; id: string }) => {
        expect(item.story_id === null || typeof item.story_id === 'string').toBe(true);
      });
    });
  });
});
