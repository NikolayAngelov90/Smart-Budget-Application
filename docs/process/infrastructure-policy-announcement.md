# Team Announcement: 20% Infrastructure Time Policy

**Date**: 2026-02-06
**From**: Scrum Master
**To**: Development Team

---

## What's Changing

Starting with **Epic 10**, we are formalizing a **20% infrastructure time allocation** for every epic. This means **1 out of every 5 stories** will be dedicated to infrastructure work.

## Why

Our Epic 6 and Epic 8 retrospectives identified a recurring pattern: technical debt accumulates when we focus exclusively on feature delivery. This leads to:

- Slower velocity in later epics (working around old issues)
- Growing retrospective action item backlogs
- Increased defect rates in areas with deferred maintenance

By dedicating 20% of our capacity to infrastructure, we address these issues proactively rather than reactively.

## What Counts as Infrastructure

Infrastructure work includes:

- **Tech Debt**: Refactoring, dependency upgrades, architecture improvements
- **Quality**: Test coverage, code review tooling, linting improvements
- **Testing**: Test utilities, integration tests, test infrastructure
- **Process**: Workflow improvements, documentation, templates
- **Tooling**: Build optimization, CI/CD improvements, developer tools
- **Security**: Vulnerability fixes, dependency scanning
- **Performance**: Profiling, optimization, monitoring

## What Doesn't Count

- New user-facing features
- Bug fixes for recent stories
- UI/UX improvements

## How It Works

1. During epic planning, the SM reserves 1 of 5 story slots for infrastructure
2. The infrastructure story is selected based on retrospective action items or identified tech debt
3. Infrastructure percentage is tracked in `sprint-status.yaml`
4. Retrospectives validate the allocation (warning if below 15% or above 30%)

## Example from Epic 9

Epic 9 was a full infrastructure epic (100%), addressing action items from Epic 6 and 8 retrospectives:
- Story 9-1: Redis migration (Tech Debt)
- Story 9-2: Test utilities library (Testing)
- Story 9-8: Deployment checklist (Tooling)
- Story 9-9: Modernize tsconfig (Tech Debt)

Going forward, infrastructure stories will be distributed across feature epics rather than batched.

## Resources

- [Full Policy Document](infrastructure-policy.md)
- [Infrastructure Story Template](../templates/infrastructure-story-template.md)
- [Retrospective Action Items](retrospective-action-item-tracking.md)

## Questions?

Reach out to the Scrum Master or Tech Lead with questions or suggestions about this policy. The policy will be reviewed quarterly based on retrospective feedback.
