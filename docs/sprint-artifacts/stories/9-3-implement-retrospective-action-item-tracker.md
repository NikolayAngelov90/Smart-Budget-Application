# Story 9.3: Implement Retrospective Action Item Tracker

Status: ready-for-dev

## Story

As a Scrum Master,
I want retrospective action items automatically tracked in a centralized YAML file,
So that HIGH priority findings from previous epics are not forgotten during future epic planning.

## Acceptance Criteria

**AC-9.3.1:** YAML Schema Creation
✅ Create `docs/sprint-artifacts/retrospective-action-items.yaml` with structured schema for tracking action items

**AC-9.3.2:** Auto-Extraction from Retrospective
✅ Extend retrospective workflow to automatically extract action items from "Recommended Actions" section of generated retrospective markdown

**AC-9.3.3:** YAML File Updates
✅ Workflow appends new action items to YAML file with fields: `id`, `priority`, `description`, `status`, `epic_assigned`, `story_id`

**AC-9.3.4:** Warning for Aged Items
✅ Workflow warns if HIGH priority items unaddressed for 2+ epics (e.g., Epic 6 item still pending in Epic 9)

**AC-9.3.5:** Backfill Historical Data
✅ Manually backfill Epic 6 and Epic 8 action items into initial YAML file

**AC-9.3.6:** Status Tracking
✅ Support status values: `pending`, `in-progress`, `completed`, `deferred`, `obsolete`

**AC-9.3.7:** Cross-Reference Validation
✅ Validate `epic_assigned` and `story_id` references exist in sprint-status.yaml

**AC-9.3.8:** Documentation
✅ Document action item tracker workflow in `docs/process/retrospective-action-item-tracking.md`

## Tasks / Subtasks

- [ ] Create YAML schema and initial file (AC: 9.3.1, 9.3.5)
  - [ ] Create `docs/sprint-artifacts/retrospective-action-items.yaml`
  - [ ] Define schema structure:
    ```yaml
    epic-{N}:
      retrospective_date: YYYY-MM-DD
      action_items:
        - id: epic{N}-{priority}-{index}
          priority: CRITICAL | HIGH | MEDIUM | LOW
          description: string
          status: pending | in-progress | completed | deferred | obsolete
          epic_assigned: number | null
          story_id: string | null
          notes: string | null
    ```
  - [ ] Backfill Epic 6 action items (8 items from epic-6-retrospective.md)
  - [ ] Backfill Epic 8 action items (10 items from epic-8-retrospective.md)
  - [ ] Add header comments explaining schema and status values

- [ ] Extend retrospective workflow (AC: 9.3.2, 9.3.3)
  - [ ] Locate retrospective workflow file: `.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml`
  - [ ] Add new step after document generation: "Extract Action Items"
  - [ ] Parse generated retrospective markdown for "Recommended Actions" section
  - [ ] Extract action items with priority labels (CRITICAL, HIGH, MEDIUM, LOW)
  - [ ] Generate unique action item IDs: `epic{N}-{priority}-{index}`
  - [ ] Append extracted items to `retrospective-action-items.yaml`
  - [ ] Set initial status: `pending` for all new action items

- [ ] Implement aged item warning logic (AC: 9.3.4)
  - [ ] Add workflow step: "Check Aged Action Items"
  - [ ] Read all action items from YAML file
  - [ ] Calculate epic age: current_epic - epic_with_action_item
  - [ ] Warn if HIGH priority item pending for 2+ epics
  - [ ] Warn if CRITICAL priority item pending for 1+ epic
  - [ ] Format warning message:
    ```
    ⚠️ WARNING: 3 HIGH priority action items from Epic 6 still pending (3 epics old):
    - epic6-high-1: Migrate rate limiting to Redis
    - epic6-high-2: Add insight engagement analytics
    - epic6-high-3: Complete Story 6-3 pagination UI

    Consider assigning these to upcoming Epic 9 stories.
    ```
  - [ ] Display warnings in retrospective workflow output

- [ ] Add cross-reference validation (AC: 9.3.7)
  - [ ] Create validation script: `.bmad/bmm/workflows/4-implementation/retrospective/validate-action-items.js`
  - [ ] Read `retrospective-action-items.yaml` and `sprint-status.yaml`
  - [ ] Validate `epic_assigned` exists in sprint-status.yaml
  - [ ] Validate `story_id` exists in sprint-status.yaml (if not null)
  - [ ] Warn if references invalid
  - [ ] Run validation as part of retrospective workflow

- [ ] Create status update helper (AC: 9.3.6)
  - [ ] Create script: `.bmad/core/tasks/update-action-item-status.js`
  - [ ] Accept parameters: `action_item_id`, `new_status`, `epic_assigned`, `story_id`
  - [ ] Update YAML file with new status
  - [ ] Validate status is one of: `pending`, `in-progress`, `completed`, `deferred`, `obsolete`
  - [ ] Example usage: `node update-action-item-status.js epic6-high-1 in-progress 9 9-1`

- [ ] Write documentation (AC: 9.3.8)
  - [ ] Create `docs/process/retrospective-action-item-tracking.md`
  - [ ] Document YAML schema and status definitions
  - [ ] Document retrospective workflow integration
  - [ ] Document manual status update process
  - [ ] Provide example workflow: retrospective → extract → warn → assign to stories
  - [ ] Add troubleshooting section (YAML parsing errors, validation failures)

- [ ] Write unit tests (AC: All)
  - [ ] Test action item extraction from retrospective markdown
  - [ ] Test YAML file update (append new items)
  - [ ] Test aged item warning logic (2+ epics for HIGH, 1+ epic for CRITICAL)
  - [ ] Test cross-reference validation (valid and invalid epic/story IDs)
  - [ ] Test status update helper script

- [ ] Integration test with retrospective workflow (AC: 9.3.2, 9.3.3, 9.3.4)
  - [ ] Run retrospective workflow on mock Epic 9 retrospective
  - [ ] Verify action items extracted and added to YAML file
  - [ ] Verify warnings generated for aged Epic 6 and Epic 8 items
  - [ ] Verify YAML file structure valid

## Dev Notes

- **Problem Solved:** HIGH priority action items from Epic 6 retrospective (Redis migration, insight analytics) were not carried forward to Epic 7 or Epic 8 planning. This caused technical debt accumulation and repeated retrospective findings.
- **YAML Format:** YAML chosen for human-readability and easy manual editing. Alternative considered: JSON (less readable), Markdown table (harder to parse).
- **Automated Extraction:** Retrospective markdown "Recommended Actions" section must follow consistent format for parsing:
  ```markdown
  ## Recommended Actions for Future Epics

  ### High Priority
  1. **[CRITICAL/HIGH/MEDIUM/LOW]** Description here
  ```
- **Manual Override:** SMs can manually edit YAML file to update status, assign epics, add notes.

### Project Structure Notes

**New Files:**
- `docs/sprint-artifacts/retrospective-action-items.yaml` - Centralized action item tracker
- `docs/process/retrospective-action-item-tracking.md` - Documentation
- `.bmad/bmm/workflows/4-implementation/retrospective/validate-action-items.js` - Validation script
- `.bmad/core/tasks/update-action-item-status.js` - Status update helper

**Modified Files:**
- `.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml` - Add action item extraction and warning steps

**Example YAML Structure:**
```yaml
# docs/sprint-artifacts/retrospective-action-items.yaml
# Generated: 2026-01-06
# Retrospective action item tracking system

epic-6:
  retrospective_date: 2025-12-10
  action_items:
    - id: epic6-high-1
      priority: HIGH
      description: Migrate rate limiting to Redis for multi-instance support
      status: in-progress
      epic_assigned: 9
      story_id: 9-1
      notes: Production blocker, assigned to Epic 9 Story 9-1

    - id: epic6-high-2
      priority: HIGH
      description: Add insight engagement analytics (views, dismissals)
      status: in-progress
      epic_assigned: 9
      story_id: 9-4

epic-8:
  retrospective_date: 2025-12-15
  action_items:
    - id: epic8-critical-1
      priority: CRITICAL
      description: Create test utilities library to unblock integration tests
      status: in-progress
      epic_assigned: 9
      story_id: 9-2
```

**Alignment with Architecture:**
- BMAD workflow system (extends existing retrospective workflow)
- YAML for configuration (consistent with sprint-status.yaml)
- JavaScript for scripting (Node.js available in dev environment)

### References

- [Tech Spec: Epic 9 - Story 9-3 Acceptance Criteria](../tech-spec-epic-9.md#story-9-3-implement-retrospective-action-item-tracker)
- [Epic 8 Retrospective: Retrospective Action Item Tracker - HIGH Priority](../epic-8-retrospective.md#recommended-actions-for-future-epics)
- [Retrospective Workflow Config](.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml)
- [BMAD Workflow Engine](.bmad/core/tasks/workflow.xml)

## Dev Agent Record

### Context Reference

- [Story 9-3 Context](9-3-implement-retrospective-action-item-tracker.context.xml) - Generated 2026-01-27

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
