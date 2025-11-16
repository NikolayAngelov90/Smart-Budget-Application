### Story 2.6: First-Time User Onboarding

As a new user who just signed up,
I want a brief onboarding experience explaining key features,
So that I understand how to use Smart Budget effectively.

**Acceptance Criteria:**

**Given** I just created my account and verified my email
**When** I log in for the first time
**Then** I see a welcoming onboarding flow

**And** Welcome modal appears: "Welcome to Smart Budget! Let's get you started."
**And** Step 1: Explains transaction entry - "Track your spending in under 30 seconds"
**And** Step 2: Explains dashboard - "See where your money goes with visual charts"
**And** Step 3: Explains AI insights - "Get personalized coaching to optimize your budget"
**And** Each step has visual illustration or screenshot
**And** "Next" button advances through steps
**And** "Skip" button available to exit onboarding
**And** Final step: "Let's add your first transaction!" with CTA button
**And** Clicking CTA opens transaction entry modal
**And** Onboarding shows only once (flag stored in user preferences)
**And** User can re-trigger onboarding from Settings page
**And** Modal fully keyboard accessible (Esc to close, Tab to navigate)
**And** Mobile responsive (single column, full screen on small devices)

**Prerequisites:** Story 2.1 (signup), Story 2.3 (login), Story 1.2 (database for user preferences)

**Technical Notes:**
- Create onboarding modal component using Chakra UI Modal
- Store onboarding completion in user metadata or separate preferences table
- Check on dashboard load: if first login && !onboarding_completed, show modal
- Use Chakra UI stepper or custom carousel for multi-step flow
- Illustrations can be simple SVGs or screenshots from UX design
- Update user record: `UPDATE users SET onboarding_completed = true`
- Make onboarding retriggerable from Settings page (optional)
- Keep copy concise and action-oriented (3-4 sentences per step max)
