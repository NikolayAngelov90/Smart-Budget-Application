# Story 9.10: Formalize 20% Infrastructure Time Rule

Status: done

## Story

As a Scrum Master,
I want a formalized 20% infrastructure time policy integrated into our workflow,
So that we consistently allocate time for technical debt, quality improvements, and process enhancements to prevent future debt accumulation.

## Acceptance Criteria

**AC-9.10.1:** Policy Documentation
✅ Create `docs/process/infrastructure-policy.md` documenting the 20% infrastructure time rule and rationale

**AC-9.10.2:** Epic Planning Integration
✅ Update epic planning workflow to reserve 1 of 5 story slots for infrastructure work

**AC-9.10.3:** Infrastructure Work Definition
✅ Document criteria for what qualifies as infrastructure work (tech debt, quality, testing, process, tooling)

**AC-9.10.4:** Story Template
✅ Create infrastructure story template with standard sections

**AC-9.10.5:** Sprint Status Tracking
✅ Add infrastructure time percentage tracking to `sprint-status.yaml`

**AC-9.10.6:** Retrospective Validation
✅ Retrospective workflow checks infrastructure % and warns if <15%

**AC-9.10.7:** Examples and Anti-Patterns
✅ Document examples of infrastructure work vs feature work with edge cases

**AC-9.10.8:** Team Communication
✅ Create team announcement explaining policy and benefits

## Tasks / Subtasks

- [ ] Create infrastructure policy document (AC: 9.10.1, 9.10.3, 9.10.7)
  - [ ] Create `docs/process/infrastructure-policy.md`
  - [ ] Add header and introduction:
    - [ ] Explain 20% infrastructure time rule
    - [ ] Rationale: prevent technical debt accumulation, maintain quality
    - [ ] Based on Epic 6 and Epic 8 retrospective findings
  - [ ] Section 1: The 20% Rule
    - [ ] Allocate 1 of 5 stories per epic to infrastructure work
    - [ ] Infrastructure work = tech debt, quality, testing, process, tooling, security
    - [ ] Minimum 15% (warning threshold), target 20%, maximum 30% (don't over-invest)
  - [ ] Section 2: What Qualifies as Infrastructure
    - [ ] ✅ Technical debt: Refactoring, dependency upgrades, architecture improvements
    - [ ] ✅ Quality: Test coverage, code reviews, static analysis, linting
    - [ ] ✅ Testing: Test utilities, integration tests, E2E tests, test infrastructure
    - [ ] ✅ Process: Workflow improvements, documentation, templates, automation
    - [ ] ✅ Tooling: Developer tools, build optimization, CI/CD improvements
    - [ ] ✅ Security: Vulnerability fixes, security audits, dependency scanning
    - [ ] ✅ Performance: Profiling, optimization, monitoring, observability
  - [ ] Section 3: What Does NOT Qualify
    - [ ] ❌ New user-facing features (even if they improve quality of life)
    - [ ] ❌ Bug fixes for features implemented in current/previous epic (normal feature work)
    - [ ] ❌ UI/UX improvements for existing features
    - [ ] Edge case: Completing deferred ACs from previous epics CAN count as infrastructure if gap significant
  - [ ] Section 4: Examples
    - [ ] Example 1: Story 9-2 (Test Utilities Library) - INFRASTRUCTURE ✅
    - [ ] Example 2: Story 9-1 (Redis Migration) - INFRASTRUCTURE ✅
    - [ ] Example 3: Adding dark mode toggle - FEATURE ❌
    - [ ] Example 4: Fixing pagination bug from Story 6-3 - INFRASTRUCTURE if 2+ epics old, otherwise FEATURE
  - [ ] Section 5: Benefits
    - [ ] Prevents technical debt accumulation
    - [ ] Improves long-term velocity (less time fixing old issues)
    - [ ] Higher code quality and test coverage
    - [ ] Better developer experience
    - [ ] Reduces retrospective action item backlog

- [ ] Update epic planning workflow (AC: 9.10.2)
  - [ ] Locate epic planning workflow (likely `.bmad/bmm/workflows/2-planning/`)
  - [ ] Add step: "Reserve Infrastructure Story Slot"
  - [ ] When generating epic stories, designate 1 of 5 as infrastructure
  - [ ] Workflow prompts SM: "Which story should be infrastructure? Recommended: Story addressing retrospective action item or tech debt"

- [ ] Create infrastructure story template (AC: 9.10.4)
  - [ ] Create `docs/templates/infrastructure-story-template.md`
  - [ ] Template structure:
    ```markdown
    # Story {Epic}.{N}: {Infrastructure Work Title}

    **Type:** Infrastructure
    **Category:** [Tech Debt | Quality | Testing | Process | Tooling | Security | Performance]

    ## Story
    As a [developer/team/user],
    I want [infrastructure improvement],
    So that [quality/process benefit].

    ## Rationale
    [Explain why this infrastructure work is needed. Link to retrospective action item if applicable.]

    ## Acceptance Criteria
    [Standard AC format]

    ## Tasks / Subtasks
    [Standard task format]

    ## Dev Notes
    [Infrastructure-specific notes]
    ```

- [ ] Add sprint status tracking (AC: 9.10.5)
  - [ ] Update `sprint-status.yaml` schema to track infrastructure time
  - [ ] Add field: `infrastructure_percentage: 20%` (calculated from story types)
  - [ ] Add story metadata: `type: infrastructure` or `type: feature`
  - [ ] Example:
    ```yaml
    epic-9:
      stories:
        9-1: { status: done, type: infrastructure }
        9-2: { status: done, type: infrastructure }
        9-3: { status: done, type: infrastructure }
        9-4: { status: done, type: infrastructure }
        9-5: { status: in-progress, type: feature }
      infrastructure_percentage: 80%  # 4 of 5 stories
    ```

- [ ] Update retrospective workflow (AC: 9.10.6)
  - [ ] Extend retrospective workflow (`.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml`)
  - [ ] Add step: "Validate Infrastructure Time Allocation"
  - [ ] Read `sprint-status.yaml` for completed epic
  - [ ] Calculate infrastructure_percentage = (infrastructure stories / total stories) * 100
  - [ ] If <15%: ⚠️ WARNING: Infrastructure time only 10% (target: 20%). Risk of tech debt accumulation.
  - [ ] If 15-30%: ✅ Infrastructure time within healthy range (20%)
  - [ ] If >30%: ⚠️ WARNING: Infrastructure time 40% (target: 20%). May be delaying feature delivery.

- [ ] Write documentation examples (AC: 9.10.7)
  - [ ] Add `docs/process/infrastructure-examples.md`
  - [ ] 10 examples of infrastructure work with explanations
  - [ ] 10 examples of feature work that might be confused as infrastructure
  - [ ] Edge cases and how to classify them

- [ ] Create team announcement (AC: 9.10.8)
  - [ ] Write announcement explaining new policy
  - [ ] Benefits: prevents tech debt, improves quality, sustainable velocity
  - [ ] How it works: 1 of 5 stories per epic reserved for infrastructure
  - [ ] Examples of infrastructure work
  - [ ] Link to full policy documentation
  - [ ] Format for team Slack/email

- [ ] Write policy validation tests (AC: All)
  - [ ] Test infrastructure_percentage calculation
  - [ ] Test retrospective warning thresholds (<15%, >30%)
  - [ ] Test story type classification (infrastructure vs feature)

## Dev Notes

- **Strategic Shift:** This policy is a PROCESS CHANGE, not code implementation. Success measured by adoption, not test coverage.
- **Why 20%?** Based on industry best practices (Google "20% time", Atlassian "ShipIt Days"). 1 of 5 stories = 20% time allocation.
- **Flexibility:** 20% is a guideline, not a hard rule. Some epics may need 0% (greenfield features), others 40% (technical debt sprint). Average over 3-5 epics should be ~20%.
- **Retrospective Enforcement:** Retrospective workflow validates adherence and warns if off-target. Creates accountability.

### Project Structure Notes

**New Files:**
- `docs/process/infrastructure-policy.md` - Main policy document
- `docs/process/infrastructure-examples.md` - Examples and edge cases
- `docs/templates/infrastructure-story-template.md` - Story template
- `docs/process/20-percent-rule-announcement.md` - Team announcement draft

**Modified Files:**
- `.bmad/bmm/workflows/2-planning/epic-planning.yaml` (or similar) - Add infrastructure story reservation
- `.bmad/bmm/workflows/4-implementation/retrospective/workflow.yaml` - Add infrastructure % validation
- `sprint-status.yaml` schema - Add `type` field to stories, `infrastructure_percentage` to epics

**Example sprint-status.yaml:**
```yaml
epic-9:
  title: "Technical Foundation & Quality Infrastructure"
  status: in-progress
  stories:
    9-1: { status: done, type: infrastructure }
    9-2: { status: done, type: infrastructure }
    9-3: { status: done, type: infrastructure }
    9-4: { status: in-progress, type: infrastructure }
    9-5: { status: pending, type: infrastructure }
  infrastructure_percentage: 100%  # All infrastructure epic
  notes: "Full infrastructure epic to address Epic 6 and Epic 8 retrospective action items"

epic-10:
  title: "User Notifications and Email Integration"
  status: draft
  stories:
    10-1: { status: pending, type: feature }
    10-2: { status: pending, type: feature }
    10-3: { status: pending, type: feature }
    10-4: { status: pending, type: feature }
    10-5: { status: pending, type: infrastructure }  # 1 of 5 reserved
  infrastructure_percentage: 20%  # Target met
```

**Alignment with Architecture:**
- BMAD workflow system (extends existing planning and retrospective workflows)
- YAML for configuration (consistent with sprint-status.yaml)
- Process documentation (no production code changes)

### References

- [Tech Spec: Epic 9 - Story 9-10 Acceptance Criteria](../tech-spec-epic-9.md#story-9-10-formalize-20-infrastructure-time-rule)
- [Epic 8 Retrospective: 20% Infrastructure Time Rule - STRATEGIC SHIFT](../epic-8-retrospective.md#recommended-actions-for-future-epics)
- [Google 20% Time](https://en.wikipedia.org/wiki/20%25_Project)
- [Atlassian: Managing Technical Debt](https://www.atlassian.com/agile/software-development/technical-debt)

## Dev Agent Record

### Context Reference

- [Story 9-10 Context](9-10-formalize-20-percent-infrastructure-rule.context.xml) - To be created during dev workflow

### Agent Model Used

TBD (Claude Sonnet 4.5)

### Debug Log References

TBD

### Completion Notes List

TBD - To be filled during implementation

### File List

TBD - To be filled during implementation
