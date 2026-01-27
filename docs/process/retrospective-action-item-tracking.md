# Retrospective Action Item Tracking System

**Version:** 1.0
**Last Updated:** 2026-01-27
**Owner:** Scrum Master (Bob)

## Overview

The Retrospective Action Item Tracking System ensures that HIGH and CRITICAL priority findings from epic retrospectives are not forgotten during future epic planning. This system automatically extracts action items from retrospectives, tracks them in a centralized YAML file, and warns when items remain unaddressed for too long.

## Purpose

**Problem Solved:**
- Epic 6 retrospective identified HIGH priority action items (Redis migration, engagement analytics)
- These items were not carried forward to Epic 8 planning
- Pattern of retrospective recommendations being ignored

**Solution:**
- Automated extraction of action items from retrospectives
- Centralized YAML tracking file with status and ownership
- Aged item warnings during retrospective workflow
- Cross-reference validation against sprint status

## YAML Schema

### File Location

```
docs/sprint-artifacts/retrospective-action-items.yaml
```

### Schema Structure

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

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique identifier: `epic{N}-{priority}-{index}` | `epic6-high-1` |
| `priority` | enum | Urgency level: CRITICAL, HIGH, MEDIUM, LOW | `HIGH` |
| `description` | string | What needs to be done | `Migrate rate limiting to Redis/Upstash` |
| `status` | enum | Current state (see Status Values below) | `in-progress` |
| `epic_assigned` | number\|null | Epic number where work is planned | `9` |
| `story_id` | string\|null | Story key if work is tracked | `9-1-migrate-rate-limiting-to-redis` |
| `notes` | string\|null | Additional context or updates | `Completed in Epic 9 Story 9-1` |

### Status Values

| Status | Meaning | When to Use |
|--------|---------|-------------|
| `pending` | Not yet started | Default for newly extracted action items |
| `in-progress` | Currently being worked on | Story is in sprint and being developed |
| `completed` | Implementation finished | Story is done and deployed |
| `deferred` | Postponed to future epic | Deprioritized but not abandoned |
| `obsolete` | No longer relevant | Superseded by other work or requirements changed |

### Priority Levels

| Priority | Meaning | Aged Item Threshold |
|----------|---------|---------------------|
| **CRITICAL** | Production blocker or test blocker | Warn if pending for 1+ epic |
| **HIGH** | Feature completeness or strategic gap | Warn if pending for 2+ epics |
| **MEDIUM** | Quality improvement or process enhancement | Warn if pending for 3+ epics |
| **LOW** | Nice-to-have or future consideration | No warning |

## Workflow Integration

### Automatic Extraction

The retrospective workflow (`.bmad/bmm/workflows/4-implementation/retrospective/instructions.md`) includes substep 11.5 which:

1. **Parses Retrospective Document**
   - Reads the "Recommended Actions for Future Epics" section
   - Extracts priority levels from section headings (High Priority, Medium Priority, etc.)
   - Parses action item descriptions and details

2. **Generates Action Items**
   - Creates unique IDs: `epic{N}-{priority}-{index}`
   - Sets initial status to `pending`
   - Leaves `epic_assigned` and `story_id` as `null` (to be filled during planning)
   - Captures notes from "Why", "Effort", "Epic" fields

3. **Updates YAML File**
   - Appends new items to `retrospective-action-items.yaml`
   - Preserves existing entries
   - Maintains YAML structure and formatting

4. **Aged Item Warnings**
   - Scans all pending items
   - Calculates age: `current_epic_number - epic_where_created`
   - Warns if items exceed threshold for their priority level
   - Example output:
     ```
     ⚠️ AGED ACTION ITEMS WARNING

     - epic6-high-2 (HIGH) - Created 2 epics ago
       Description: Add insight engagement analytics
       Status: pending
       Epic Assigned: None
     ```

5. **Cross-Reference Validation**
   - Loads `sprint-status.yaml`
   - Verifies `epic_assigned` values exist (e.g., `epic-9: backlog`)
   - Verifies `story_id` values exist (e.g., `9-4-add-insight-engagement-analytics: drafted`)
   - Warns if references are invalid

### Manual Workflow Steps

**During Epic Planning:**
1. Review `retrospective-action-items.yaml` for pending items
2. For HIGH/CRITICAL items, create stories in the next epic
3. Update `epic_assigned` and `story_id` fields using the helper script
4. Mark lower priority items as `deferred` if not addressing this epic

**During Story Implementation:**
1. Update status from `pending` to `in-progress` when story starts
2. Update status to `completed` when story is done
3. Add notes with completion date and summary

**During Retrospective:**
1. Review completed action items - were they effective?
2. Review deferred items - are they still relevant?
3. Mark obsolete items if requirements changed

## Status Update Helper Script

### Location

```
.bmad/bmm/workflows/4-implementation/retrospective/update-action-item-status.ts
```

### Usage

```bash
tsx .bmad/bmm/workflows/4-implementation/retrospective/update-action-item-status.ts \
  <item-id> <new-status> [epic-assigned] [story-id] [notes]
```

### Examples

**Update status only:**
```bash
tsx update-action-item-status.ts epic6-high-2 in-progress
```

**Assign to epic and story:**
```bash
tsx update-action-item-status.ts epic6-high-2 in-progress 9 9-4-add-insight-engagement-analytics
```

**Mark as completed with notes:**
```bash
tsx update-action-item-status.ts epic6-high-1 completed 9 9-1-migrate-rate-limiting-to-redis "Production-ready with Upstash Redis integration"
```

**Mark as deferred:**
```bash
tsx update-action-item-status.ts epic6-low-1 deferred null null "Deferred to future epic - manual testing sufficient"
```

### Prerequisites

- Node.js 22.x
- `tsx` package (already installed as dev dependency)
- `js-yaml` library (available as transitive dependency)

### Error Handling

The script validates:
- ✅ Item ID exists in YAML file
- ✅ Status value is valid (`pending`, `in-progress`, `completed`, `deferred`, `obsolete`)
- ✅ YAML file exists at expected path
- ✅ Epic/story references are properly formatted (validation against sprint-status.yaml is manual)

## Best Practices

### For Scrum Masters

1. **Run retrospective workflow completely** - Don't skip substep 11.5
2. **Review aged item warnings seriously** - These indicate process failures
3. **Update action items weekly** - Keep the tracking file current
4. **Archive completed items** - Consider moving to `retrospective-action-items-archive.yaml` annually

### For Product Owners

1. **Review pending HIGH items during epic planning** - Prioritize addressing these
2. **Justify deferrals** - If deferring a HIGH item, add clear notes explaining why
3. **Close the loop** - Mark items obsolete if requirements changed

### For Development Team

1. **Update status when starting stories** - `pending` → `in-progress`
2. **Update status when finishing** - `in-progress` → `completed`
3. **Add completion notes** - Document what was delivered
4. **Link to story files** - Populate `story_id` for traceability

## Troubleshooting

### Action Items Not Extracted

**Symptom:** Retrospective completed but no items added to YAML

**Causes:**
- "Recommended Actions for Future Epics" section missing from retrospective
- Section title doesn't match expected format
- Retrospective workflow skipped substep 11.5

**Solution:**
1. Check retrospective document has "Recommended Actions" section
2. Manually add items using helper script or by editing YAML directly

### Aged Item Warnings Not Appearing

**Symptom:** Old items exist but no warnings displayed

**Causes:**
- Items marked as `deferred` or `obsolete` (warnings only for `pending`)
- Items are MEDIUM/LOW priority (longer warning thresholds)
- Workflow substep 11.5 not executed

**Solution:**
1. Check item status in YAML - should be `pending`
2. Verify priority level matches age (HIGH: 2+ epics, CRITICAL: 1+ epic)
3. Re-run retrospective workflow or manually check aged items

### Cross-Reference Validation Errors

**Symptom:** Invalid epic or story references detected

**Causes:**
- `epic_assigned` or `story_id` values don't exist in `sprint-status.yaml`
- Typo in story key (e.g., `9-4` vs `9-04`)
- Epic number doesn't have entry in status file

**Solution:**
1. Check `sprint-status.yaml` for correct epic/story keys
2. Update action item using helper script with correct references
3. Add missing entries to sprint-status.yaml if needed

### Helper Script Errors

**Symptom:** `tsx` command not found or script fails

**Causes:**
- `tsx` package not installed
- Running from wrong directory
- js-yaml dependency not available

**Solution:**
```bash
# Install tsx if missing
npm install tsx --save-dev

# Run from project root
cd /path/to/Smart-Budget-Application

# Verify tsx works
npx tsx --version

# Run script with full path
npx tsx .bmad/bmm/workflows/4-implementation/retrospective/update-action-item-status.ts
```

## Metrics and Success Criteria

### Process Health Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Action Item Follow-Through Rate** | ≥80% | `(completed + deferred with notes) / total` |
| **Aged HIGH Items** | ≤2 at any time | Count items with status=pending, priority=HIGH, age≥2 |
| **Time to Address CRITICAL Items** | <1 epic | Days between retro date and `in-progress` status |
| **Action Item Creation Velocity** | 5-10 per epic | Count new items added per retrospective |

### Success Indicators

✅ **Working Well:**
- Aged item warnings trigger epic planning discussions
- HIGH priority items get stories assigned within 1 epic
- Retrospective recommendations consistently addressed
- Team references tracking file during planning

❌ **Needs Improvement:**
- Multiple HIGH items pending for 3+ epics
- Action items marked `pending` but never revisited
- Tracking file not updated during sprints
- Retrospective findings ignored despite tracking

## Related Documentation

- [Epic 6 Retrospective](../sprint-artifacts/epic-6-retrospective.md) - Original problem identification
- [Epic 8 Retrospective](../sprint-artifacts/epic-8-retrospective.md) - Process fix recommendation
- [Retrospective Workflow](../../.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml) - Workflow configuration
- [Sprint Status Tracking](../sprint-artifacts/sprint-status.yaml) - Epic and story status reference

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-27 | Initial documentation - Story 9-3 implementation |

## Questions or Feedback

For questions about this system:
- **Process questions**: Ask Scrum Master (Bob)
- **Technical issues**: Check Story 9-3 implementation notes
- **Feature requests**: Add to next retrospective "Process Improvements" section
