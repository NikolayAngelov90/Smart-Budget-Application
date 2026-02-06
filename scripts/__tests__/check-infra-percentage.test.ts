/**
 * Infrastructure Percentage Checker Tests
 * Story 9-10: Formalize 20% Infrastructure Time Rule (AC-9.10.5, AC-9.10.6)
 */

export {};

const {
  parseInfraTracking,
  calculatePercentage,
  getStatus,
  THRESHOLDS,
} = require('../check-infra-percentage');

describe('check-infra-percentage', () => {
  describe('THRESHOLDS', () => {
    it('has correct warning thresholds', () => {
      expect(THRESHOLDS.WARNING_LOW).toBe(15);
      expect(THRESHOLDS.TARGET).toBe(20);
      expect(THRESHOLDS.WARNING_HIGH).toBe(30);
    });
  });

  describe('calculatePercentage', () => {
    it('returns 0 for zero total', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it('calculates correct percentage', () => {
      expect(calculatePercentage(1, 5)).toBe(20);
      expect(calculatePercentage(2, 10)).toBe(20);
      expect(calculatePercentage(3, 10)).toBe(30);
    });

    it('rounds to nearest integer', () => {
      expect(calculatePercentage(1, 3)).toBe(33);
      expect(calculatePercentage(2, 3)).toBe(67);
    });

    it('returns 100 for all infrastructure', () => {
      expect(calculatePercentage(5, 5)).toBe(100);
    });
  });

  describe('getStatus', () => {
    it('returns below_target for < 15%', () => {
      expect(getStatus(0)).toBe('below_target');
      expect(getStatus(10)).toBe('below_target');
      expect(getStatus(14)).toBe('below_target');
    });

    it('returns on_target for 15-30%', () => {
      expect(getStatus(15)).toBe('on_target');
      expect(getStatus(20)).toBe('on_target');
      expect(getStatus(25)).toBe('on_target');
      expect(getStatus(30)).toBe('on_target');
    });

    it('returns above_target for > 30%', () => {
      expect(getStatus(31)).toBe('above_target');
      expect(getStatus(50)).toBe('above_target');
      expect(getStatus(100)).toBe('above_target');
    });
  });

  describe('parseInfraTracking', () => {
    it('parses a valid infrastructure_tracking section', () => {
      const yaml = `
development_status:
  epic-1: contexted

infrastructure_tracking:
  epic-9:
    total_stories: 10
    infrastructure_stories:
      - 9-1-migrate-rate-limiting
      - 9-2-test-utilities
    feature_stories:
      - 9-4-analytics
      - 9-5-pwa-analytics
    infrastructure_percentage: 20
    status: on_target
    notes: "Test epic"
`;
      const result = parseInfraTracking(yaml);
      expect(result['epic-9']).toBeDefined();
      expect(result['epic-9']!.total_stories).toBe(10);
      expect(result['epic-9']!.infrastructure_stories).toHaveLength(2);
      expect(result['epic-9']!.feature_stories).toHaveLength(2);
      expect(result['epic-9']!.infrastructure_percentage).toBe(20);
      expect(result['epic-9']!.status).toBe('on_target');
      expect(result['epic-9']!.notes).toBe('Test epic');
    });

    it('parses empty story lists', () => {
      const yaml = `
infrastructure_tracking:
  epic-8:
    total_stories: 5
    infrastructure_stories: []
    feature_stories:
      - 8-1-csv
      - 8-2-pdf
    infrastructure_percentage: 0
    status: below_target
`;
      const result = parseInfraTracking(yaml);
      expect(result['epic-8']).toBeDefined();
      expect(result['epic-8']!.infrastructure_stories).toHaveLength(0);
      expect(result['epic-8']!.feature_stories).toHaveLength(2);
    });

    it('parses multiple epics', () => {
      const yaml = `
infrastructure_tracking:
  epic-7:
    total_stories: 4
    infrastructure_stories:
      - 7-1-tests
    feature_stories: []
    infrastructure_percentage: 100
    status: above_target
  epic-8:
    total_stories: 5
    infrastructure_stories: []
    feature_stories:
      - 8-1-csv
    infrastructure_percentage: 0
    status: below_target
`;
      const result = parseInfraTracking(yaml);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['epic-7']).toBeDefined();
      expect(result['epic-8']).toBeDefined();
    });

    it('returns empty object when no infrastructure_tracking section', () => {
      const yaml = `
development_status:
  epic-1: contexted
`;
      const result = parseInfraTracking(yaml);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('infrastructure policy document', () => {
    const nodeFs = require('fs');
    const nodePath = require('path');
    const policyPath = nodePath.join(__dirname, '..', '..', 'docs', 'process', 'infrastructure-policy.md');

    it('policy document exists', () => {
      expect(nodeFs.existsSync(policyPath)).toBe(true);
    });

    it('contains 20% rule', () => {
      const content = nodeFs.readFileSync(policyPath, 'utf-8');
      expect(content).toContain('20%');
      expect(content).toContain('Infrastructure Time');
    });

    it('documents qualification criteria', () => {
      const content = nodeFs.readFileSync(policyPath, 'utf-8');
      expect(content).toContain('Tech Debt');
      expect(content).toContain('Quality');
      expect(content).toContain('Testing');
      expect(content).toContain('Process');
      expect(content).toContain('Tooling');
      expect(content).toContain('Security');
      expect(content).toContain('Performance');
    });

    it('documents what does NOT qualify', () => {
      const content = nodeFs.readFileSync(policyPath, 'utf-8');
      expect(content).toContain('Does NOT Qualify');
      expect(content).toContain('New user-facing features');
    });

    it('includes examples of infrastructure and feature work', () => {
      const content = nodeFs.readFileSync(policyPath, 'utf-8');
      expect(content).toContain('Infrastructure Work (Qualifies)');
      expect(content).toContain('Feature Work (Does NOT Qualify)');
    });

    it('documents warning thresholds', () => {
      const content = nodeFs.readFileSync(policyPath, 'utf-8');
      expect(content).toContain('15%');
      expect(content).toContain('30%');
    });
  });

  describe('infrastructure story template', () => {
    const nodeFs = require('fs');
    const nodePath = require('path');
    const templatePath = nodePath.join(__dirname, '..', '..', 'docs', 'templates', 'infrastructure-story-template.md');

    it('template exists', () => {
      expect(nodeFs.existsSync(templatePath)).toBe(true);
    });

    it('contains required sections', () => {
      const content = nodeFs.readFileSync(templatePath, 'utf-8');
      expect(content).toContain('Type:** Infrastructure');
      expect(content).toContain('Category:');
      expect(content).toContain('Rationale');
      expect(content).toContain('Acceptance Criteria');
      expect(content).toContain('Infrastructure Classification');
    });
  });

  describe('team announcement', () => {
    const nodeFs = require('fs');
    const nodePath = require('path');
    const announcePath = nodePath.join(__dirname, '..', '..', 'docs', 'process', 'infrastructure-policy-announcement.md');

    it('announcement document exists', () => {
      expect(nodeFs.existsSync(announcePath)).toBe(true);
    });

    it('explains the policy', () => {
      const content = nodeFs.readFileSync(announcePath, 'utf-8');
      expect(content).toContain('20% Infrastructure Time');
      expect(content).toContain('1 out of every 5 stories');
    });

    it('includes benefits and examples', () => {
      const content = nodeFs.readFileSync(announcePath, 'utf-8');
      expect(content).toContain('What Counts as Infrastructure');
      expect(content.toLowerCase()).toContain('doesn\'t count');
    });
  });

  describe('sprint-status.yaml integration', () => {
    const nodeFs = require('fs');
    const nodePath = require('path');
    const yamlPath = nodePath.join(__dirname, '..', '..', 'docs', 'sprint-artifacts', 'sprint-status.yaml');

    it('sprint-status.yaml has infrastructure_tracking section', () => {
      const content = nodeFs.readFileSync(yamlPath, 'utf-8');
      expect(content).toContain('infrastructure_tracking:');
    });

    it('tracks Epic 9 infrastructure percentage', () => {
      const content = nodeFs.readFileSync(yamlPath, 'utf-8');
      const tracking = parseInfraTracking(content);
      expect(tracking['epic-9']).toBeDefined();
      expect(tracking['epic-9']!.infrastructure_percentage).toBe(60);
    });

    it('includes story type documentation in header', () => {
      const content = nodeFs.readFileSync(yamlPath, 'utf-8');
      expect(content).toContain('infrastructure_percentage');
      expect(content).toContain('infrastructure_stories');
      expect(content).toContain('feature_stories');
    });
  });
});
