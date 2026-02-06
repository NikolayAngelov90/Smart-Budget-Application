# 20% Infrastructure Time Policy

## Overview

This policy formalizes the allocation of **20% of epic capacity** (1 of every 5 stories) to infrastructure work. Infrastructure work includes technical debt reduction, quality improvements, testing, tooling, and process enhancements.

**Rationale:** Epic 6 and Epic 8 retrospectives identified recurring technical debt accumulation. Without dedicated infrastructure time, quality issues compound across sprints, slowing velocity and increasing defect rates. This policy prevents debt accumulation proactively.

---

## The 20% Rule

| Metric | Value |
|--------|-------|
| **Target** | 20% of stories per epic dedicated to infrastructure |
| **Minimum** | 15% (warning threshold - risk of debt accumulation) |
| **Maximum** | 30% (warning threshold - may delay feature delivery) |
| **Measurement** | Infrastructure stories / total stories per epic |

### How It Works

- When planning an epic with 5 stories, **reserve 1 story** for infrastructure work
- When planning an epic with 10 stories, **reserve 2 stories** for infrastructure work
- Infrastructure stories should address retrospective action items, tech debt, or quality improvements
- The Scrum Master designates infrastructure stories during epic planning

### Flexibility

The 20% target is a guideline, not a hard rule:
- **Greenfield epics** (entirely new features) may have 0% infrastructure if no debt exists
- **Debt reduction epics** (like Epic 7, Epic 9) may have 80-100% infrastructure
- **Average over 3-5 epics** should track close to 20%

---

## What Qualifies as Infrastructure

### Eligible Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Tech Debt** | Refactoring, dependency upgrades, architecture improvements | Redis migration (9-1), tsconfig modernization (9-9) |
| **Quality** | Test coverage, code review tooling, static analysis, linting | Test utilities library (9-2) |
| **Testing** | Test infrastructure, integration tests, E2E tests | Test framework setup (7-1) |
| **Process** | Workflow improvements, documentation, templates, automation | Retrospective action tracker (9-3), this policy (9-10) |
| **Tooling** | Developer tools, build optimization, CI/CD improvements | Deployment checklist (9-8) |
| **Security** | Vulnerability fixes, security audits, dependency scanning | (future work) |
| **Performance** | Profiling, optimization, monitoring, observability | Performance validation (7-2) |

### What Does NOT Qualify

| Not Infrastructure | Why | Correct Classification |
|--------------------|-----|----------------------|
| New user-facing features | Direct product value delivery | Feature |
| Bug fixes for current/previous epic | Normal development work | Feature |
| UI/UX improvements for existing features | User-facing enhancement | Feature |
| Adding new API endpoints for product features | Product functionality | Feature |

### Edge Cases

- **Completing deferred ACs from 2+ epics ago**: Counts as infrastructure (the gap indicates systemic deferral)
- **Adding analytics to existing features**: Infrastructure if it's observability/monitoring; Feature if it's product analytics for users
- **Upgrading a library**: Infrastructure if it's maintenance/security; Feature if it enables a new product capability
- **Writing documentation**: Infrastructure if it's developer/process docs; Feature if it's user-facing help content

---

## Examples

### Infrastructure Work (Qualifies)

1. **Story 9-1: Migrate Rate Limiting to Redis** - Tech debt reduction, architecture improvement
2. **Story 9-2: Create Test Utilities Library** - Testing infrastructure, developer tooling
3. **Story 9-3: Implement Retrospective Action Item Tracker** - Process improvement
4. **Story 9-4: Add Insight Engagement Analytics** - Observability and monitoring
5. **Story 9-8: Create Deployment Checklist** - Tooling and process automation
6. **Story 9-9: Modernize tsconfig** - Tech debt, build tooling
7. **Story 7-1: Test Framework Setup** - Testing infrastructure
8. **Story 7-2: Performance Validation** - Performance infrastructure
9. **Upgrading Next.js to latest version** - Dependency maintenance
10. **Adding error monitoring (Sentry)** - Observability

### Feature Work (Does NOT Qualify)

1. **Adding a dark mode toggle** - User-facing feature
2. **Implementing email notifications** - New product feature
3. **Building a budgeting goals page** - New product feature
4. **Fixing a bug in transaction filtering** - Normal dev work (if recent)
5. **Adding drag-and-drop to category management** - UI enhancement
6. **Implementing social sharing of reports** - New product feature
7. **Adding multi-currency support** - Product feature
8. **Building a recurring transactions feature** - Product feature
9. **Adding PDF watermark customization** - Feature enhancement
10. **Implementing a dashboard widget marketplace** - Product feature

---

## Sprint Status Tracking

Infrastructure allocation is tracked in `sprint-status.yaml` using the `infrastructure_tracking` section:

```yaml
infrastructure_tracking:
  epic-9:
    total_stories: 10
    infrastructure_stories:
      - 9-1-migrate-rate-limiting-to-redis
      - 9-2-create-test-utilities-library
      - 9-3-implement-retrospective-action-item-tracker
      - 9-8-create-deployment-checklist
      - 9-9-modernize-tsconfig
      - 9-10-formalize-20-percent-infrastructure-rule
    feature_stories:
      - 9-4-add-insight-engagement-analytics
      - 9-5-add-export-and-pwa-analytics
      - 9-6-complete-device-session-management
      - 9-7-complete-story-6-3-pagination-ui
    infrastructure_percentage: 60
    status: above_target
```

### Retrospective Validation

During retrospectives, infrastructure percentage is checked:
- **< 15%**: Warning - risk of tech debt accumulation
- **15-30%**: Healthy range - target met
- **> 30%**: Warning - may be delaying feature delivery

---

## Benefits

1. **Prevents technical debt accumulation** - Regular maintenance prevents debt from compounding
2. **Improves long-term velocity** - Less time spent debugging and working around old issues
3. **Higher code quality** - Dedicated time for refactoring, testing, and tooling
4. **Better developer experience** - Improved tools, documentation, and processes
5. **Reduces retrospective action item backlog** - Infrastructure stories address retro findings
6. **Sustainable pace** - Avoids "crunch then cleanup" cycles

---

## Policy Adoption

- **Effective**: Epic 10 onwards
- **Owner**: Scrum Master (enforcement), Tech Lead (infrastructure story selection)
- **Review**: Quarterly, based on retrospective trends
- **Exceptions**: Approved by SM + Tech Lead with documented rationale
