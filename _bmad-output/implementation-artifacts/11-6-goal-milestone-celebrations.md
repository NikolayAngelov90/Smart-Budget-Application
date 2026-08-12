# Story 11.6: Goal Milestone Celebrations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user working toward savings goals,
I want to receive visual celebrations at key milestones (25%, 50%, 75%, 100%),
so that I feel motivated and rewarded for progress.

## Acceptance Criteria

1. **Given** a user has an active savings goal, **When** the goal reaches a milestone threshold (25%, 50%, or 75%), **Then** a full-screen celebration overlay is displayed with confetti animation (auto-dismisses after 4 seconds or on tap), showing the milestone percentage, goal name, and the current saved amount.

2. **Given** a user has an active savings goal, **When** the goal reaches 100% (fully funded), **Then** the same celebration overlay plays with special "Goal Completed!" messaging and the existing "Completed!" badge continues to display on the GoalProgress component.

3. **Given** a milestone celebration has been shown for a goal at a specific threshold (25/50/75/100%), **When** the user views the same goal later, **Then** the celebration does NOT re-trigger for that threshold — it is recorded persistently in the database.

4. **Given** the user has `prefers-reduced-motion` set in their OS, **When** a milestone is reached, **Then** the confetti animation is replaced with a static badge + subtle scale-in entrance, but the overlay and messaging still display.

5. **Given** a milestone has been celebrated for a goal, **When** the GoalCard renders, **Then** a permanent milestone badge ("25% reached", "50% reached", etc.) showing the highest celebrated milestone is visible on the card.

6. **Given** a milestone celebration overlay is displayed, **When** the `aria-live="assertive"` region is present, **Then** screen readers announce the milestone achievement without requiring user focus on the overlay.

## Tasks / Subtasks

- [x] Task 1: Database migration (AC: #3)
  - [x] 1.1 Create `supabase/migrations/014_goal_milestones.sql`:
    ```sql
    ALTER TABLE public.goals
    ADD COLUMN IF NOT EXISTS milestones_celebrated INTEGER[]
    NOT NULL DEFAULT '{}';

    COMMENT ON COLUMN public.goals.milestones_celebrated IS
    'Array of milestone percentages already celebrated (25, 50, 75, 100). Prevents re-triggering.';
    ```
  - [x] 1.2 No new table, no new RLS policies needed — the `milestones_celebrated` column inherits the goals table RLS (only the goal owner can read/write).

- [x] Task 2: TypeScript types (AC: all)
  - [x] 2.1 Add `milestones_celebrated: number[]` to the `Goal` interface in `src/types/database.types.ts`:
    ```typescript
    export interface Goal {
      // ... existing fields ...
      /** Milestone thresholds (25, 50, 75, 100) that have been celebrated. Prevents re-triggering. */
      milestones_celebrated: number[];
    }
    ```
  - [x] 2.2 Update `sampleGoal` in all test files that construct `Goal` objects to include `milestones_celebrated: []`.

- [x] Task 3: Mark milestone service function and API route (AC: #3)
  - [x] 3.1 Add `markMilestoneCelebrated(supabase, userId, goalId, threshold)` to `src/lib/services/goalService.ts`:
    ```typescript
    /**
     * Records a milestone threshold as celebrated for a goal.
     * Uses Postgres array append to avoid race conditions overwriting existing milestones.
     * @throws on DB error
     */
    export async function markMilestoneCelebrated(
      supabase: SupabaseClient,
      userId: string,
      goalId: string,
      threshold: number
    ): Promise<void> {
      // Use RPC or raw update with array_append to avoid overwriting concurrent writes.
      // Since there's no RPC, read-then-write is acceptable for solo user scope.
      const { data: current, error: fetchError } = await supabase
        .from('goals')
        .select('milestones_celebrated')
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === PGRST116) return; // Goal deleted race — silently ignore
        throw fetchError;
      }
      if (!current) return;

      const existing: number[] = current.milestones_celebrated ?? [];
      if (existing.includes(threshold)) return; // Already marked — idempotent

      const { error: updateError } = await supabase
        .from('goals')
        .update({ milestones_celebrated: [...existing, threshold] })
        .eq('id', goalId)
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }
    ```
  - [x] 3.2 Create `src/app/api/goals/[id]/celebrate/route.ts`:
    - `POST /api/goals/[id]/celebrate` with body `{ threshold: number }`
    - Auth guard (same pattern as all other goal routes)
    - Validate: `threshold` must be one of `[25, 50, 75, 100]`
    - Call `markMilestoneCelebrated(supabase, user.id, id, threshold)`
    - Return `{ success: true }` status 200
    - 400 on invalid threshold; 401 on unauthenticated; 500 on error
    - `export const dynamic = 'force-dynamic'; export const revalidate = 0;`

- [x] Task 4: `MilestoneOverlay` component (AC: #1, #2, #4, #6)
  - [x] 4.1 Create `src/components/goals/MilestoneOverlay.tsx`:
    - Props:
      ```typescript
      interface MilestoneOverlayProps {
        isOpen: boolean;
        onClose: () => void;
        milestone: number;       // 25 | 50 | 75 | 100
        goalName: string;
        currentAmount: number;
        currency: string;
      }
      ```
    - Use Chakra `Modal` with `size="sm"` (centered, `isCentered`)
    - Import `useReducedMotion` from `framer-motion` to detect user preference
    - `useEffect` auto-dismiss: `setTimeout(onClose, 4000)` — clear on component unmount
    - **Confetti animation** (when NOT `reducedMotion`): render ~15 colored `motion.div` pieces positioned absolutely, falling from top (`y: '-100%'` → `y: '100vh'`, `rotate: 0` → `720`, `opacity: 1` → `0`, `duration: 2`). Each piece has different `left`, `delay`, `color` from a palette:
      ```typescript
      const CONFETTI_COLORS = ['#4299E1', '#48BB78', '#F6AD55', '#FC8181', '#B794F4', '#76E4F7', '#F687B3'];
      ```
    - **Reduced motion**: render a static `Badge` with scale-in entrance (`motion.div` with `initial={{ scale: 0.8, opacity: 0 }}`, `animate={{ scale: 1, opacity: 1 }}`, no confetti)
    - Overlay content:
      - Large milestone emoji: `🎯` for 25/50/75, `🏆` for 100
      - Heading: `{milestone}%` in large text (Chakra `Heading size="4xl"`)
      - Sub-heading: `t('milestoneMessage', { goalName })` — e.g. "Emergency Fund is 50% funded!"
      - Amount text: `t('milestoneAmount', { amount: formatAmount(currentAmount, currency) })`
      - `aria-live="assertive"` on a visually-hidden `<span>` for screen reader announcement
      - `Button` variant="ghost" to dismiss early: `t('milestoneDismiss')`
    - `data-testid="milestone-overlay"`
    - Use `formatAmount` helper (copy of pattern from GoalProgress — do NOT extract to shared util)

- [x] Task 5: Integrate milestone detection into `GoalCard` (AC: #1, #2, #3, #5)
  - [x] 5.1 Modify `src/components/goals/GoalCard.tsx`:
    - Add a 4th `useDisclosure()` for `MilestoneOverlay`:
      ```typescript
      const { isOpen: isMilestoneOpen, onOpen: onMilestoneOpen, onClose: onMilestoneClose } = useDisclosure();
      ```
    - Add state for which milestone just triggered:
      ```typescript
      const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
      ```
    - Compute current percentage:
      ```typescript
      const currentPercentage = goal.target_amount > 0
        ? Math.min(100, Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100))
        : 0;
      ```
    - Track previous percentage with `useRef`:
      ```typescript
      const prevPercentageRef = useRef<number | null>(null);
      const justTriggeredRef = useRef<Set<number>>(new Set()); // Prevent double-fire (React strict mode)
      ```
    - Add milestone detection `useEffect`:
      ```typescript
      useEffect(() => {
        const MILESTONES = [25, 50, 75, 100] as const;
        const prevPct = prevPercentageRef.current;

        if (prevPct !== null && prevPct !== currentPercentage) {
          for (const threshold of MILESTONES) {
            if (
              currentPercentage >= threshold &&
              prevPct < threshold &&
              !goal.milestones_celebrated.includes(threshold) &&
              !justTriggeredRef.current.has(threshold)
            ) {
              justTriggeredRef.current.add(threshold);
              setActiveMilestone(threshold);
              onMilestoneOpen();
              // Fire-and-forget: persist to DB (revalidate after)
              void fetch(`/api/goals/${goal.id}/celebrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold }),
              }).then(() => onMutate());
              break; // Only one milestone at a time
            }
          }
        }
        prevPercentageRef.current = currentPercentage;
      }, [currentPercentage, goal.milestones_celebrated, goal.id, onMilestoneOpen, onMutate]);
      ```
    - Add **permanent milestone badge** in the CardBody (below GoalProgress, above deadline):
      ```tsx
      {goal.milestones_celebrated.length > 0 && (
        <Badge
          colorScheme="purple"
          mt={2}
          data-testid="milestone-badge"
        >
          {t('milestoneBadge', { percentage: Math.max(...goal.milestones_celebrated) })}
        </Badge>
      )}
      ```
    - Render `MilestoneOverlay` at the bottom of the fragment:
      ```tsx
      {activeMilestone !== null && (
        <MilestoneOverlay
          isOpen={isMilestoneOpen}
          onClose={onMilestoneClose}
          milestone={activeMilestone}
          goalName={goal.name}
          currentAmount={Number(goal.current_amount)}
          currency={currency}
        />
      )}
      ```

- [x] Task 6: i18n strings (AC: all)
  - [x] 6.1 Add to `messages/en.json` `goals` namespace:
    ```json
    "milestoneTitle": "Milestone Reached!",
    "milestoneMessage": "{goalName} is {percentage}% funded!",
    "milestoneAmount": "You've saved {amount} toward your goal",
    "milestoneDismiss": "Keep Going!",
    "milestoneBadge": "{percentage}% milestone reached",
    "milestoneComplete": "Goal Complete! 🏆"
    ```
  - [x] 6.2 Add to `messages/bg.json` `goals` namespace:
    ```json
    "milestoneTitle": "Достигнато е ниво!",
    "milestoneMessage": "{goalName} е финансирана {percentage}%!",
    "milestoneAmount": "Спестили сте {amount} за тази цел",
    "milestoneDismiss": "Продължавай!",
    "milestoneBadge": "Достигнато ниво {percentage}%",
    "milestoneComplete": "Целта е изпълнена! 🏆"
    ```

- [x] Task 7: Tests (AC: all)
  - [x] 7.1 Add `markMilestoneCelebrated` tests to `src/lib/services/__tests__/goalService.test.ts`:
    - Returns early (no-op) if threshold already in milestones_celebrated
    - Appends threshold to existing array and updates
    - Returns early (no-op) on PGRST116 (goal not found)
    - Throws on other DB errors
  - [x] 7.2 Create `src/app/api/goals/[id]/celebrate/__tests__/celebrate.test.ts`:
    - `@jest-environment node`, same mock pattern as other API tests
    - 401 when unauthenticated
    - 400 on invalid threshold (e.g. 50.5, 0, 101, 'bad')
    - 200 with `{ success: true }` on valid threshold
    - 500 on service error
  - [x] 7.3 Create `src/components/goals/__tests__/MilestoneOverlay.test.tsx`:
    - Renders milestone percentage and goal name
    - Renders confetti pieces when `useReducedMotion` returns false
    - Does NOT render confetti when `useReducedMotion` returns true (reduced motion)
    - Auto-dismiss calls `onClose` after 4 seconds (mock timers)
    - Dismiss button calls `onClose` immediately
    - `aria-live="assertive"` element is present
  - [x] 7.4 Update `src/components/goals/__tests__/GoalCard.test.tsx`:
    - Add `milestones_celebrated: []` to `sampleGoal` (required by updated Goal type)
    - Test: milestone badge not shown when `milestones_celebrated` is empty
    - Test: milestone badge shown with correct text when `milestones_celebrated: [50]`
    - Test: milestone badge shows highest when `milestones_celebrated: [25, 50]` → "50% milestone reached"

## Dev Notes

### Current State (What Exists)

**Goal infrastructure** (all from Story 11.5):
- `src/lib/services/goalService.ts` — `getGoals`, `getGoal`, `createGoal`, `updateGoal`, `deleteGoal`, `addContribution`; the `PGRST116` constant is already defined; add `markMilestoneCelebrated` following the same patterns
- `src/types/database.types.ts` — `Goal` interface needs `milestones_celebrated: number[]` added
- `src/lib/hooks/useGoals.ts` — `useGoals()` returns `{ goals, isLoading, error, mutate: KeyedMutator<GoalsListResponse> }`; SWR key `/api/goals`
- `src/components/goals/GoalCard.tsx` — already has 3 `useDisclosure()` hooks + `useRef` for cancelDeleteRef; adding 4th disclosure + prev/justTriggered refs is straightforward
- `src/components/goals/GoalProgress.tsx` — the `formatAmount` helper function is defined here; copy this pattern into `MilestoneOverlay.tsx` (do NOT extract to shared util — project convention)

**Existing API route pattern** (`src/app/api/goals/[id]/contribute/route.ts`):
```typescript
// Next.js 15 async params pattern — REQUIRED:
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  // ...
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Animation library** — `framer-motion@10.16.0` is ALREADY in package.json (peer dep of Chakra UI v2). Use it:
```typescript
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
```
- `useReducedMotion()` automatically reads the OS `prefers-reduced-motion` media query — use this instead of a CSS `@media` query
- For confetti: `motion.div` with `animate={{ y: '100vh', rotate: 720, opacity: 0 }}` and `transition={{ duration: 2, ease: 'linear', delay: n * 0.1 }}`
- No `AnimatePresence` needed for confetti pieces (they're rendered inside the Modal which is already controlled by Chakra's presence)

**Chakra UI Modal for overlay:**
```typescript
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalFooter } from '@chakra-ui/react';
// Use size="sm" with isCentered; NO ModalCloseButton (auto-dismiss UX)
// Add position="relative" overflow="hidden" to ModalContent for confetti containment
```

### Architecture Compliance

Carry forward ALL lessons from Stories 11.2–11.5:

1. **Service functions accept Supabase client as parameter** — M1 from 11.2
2. **No hardcoded currency** — `preferences?.currency_format ?? ''` with empty-string guard in formatAmount
3. **DB errors throw** — `if (error) throw error;` throughout; PGRST116 handled silently (goal deleted race)
4. **Consistent API error shapes** — `{ error: { message: '...' } }` with status code
5. **No `!` non-null assertions** in source files — `?.` optional chaining only
6. **`export const dynamic = 'force-dynamic'; export const revalidate = 0;`** on the new celebrate route
7. **Auth pattern**: `createClient()` → `supabase.auth.getUser()` → 401 if no session
8. **No unused i18n keys** — verify every new key is used in a component
9. **`justTriggeredRef`** prevents the celebration from double-firing in React 18 strict mode (effects run twice during development)
10. **`prevPercentageRef` initializes to `null`** — never trigger celebration on first render (the milestone was crossed in a previous session and is already in `milestones_celebrated`)

### Key Design Decisions (Prevent LLM mistakes)

**Why DB column instead of localStorage?**
The AC says "milestone is recorded so it only triggers once per threshold". localStorage doesn't survive browser data clear. The `milestones_celebrated INTEGER[]` column on the `goals` table is the persistent source of truth. It inherits existing RLS policies.

**Why `useEffect` with `useRef` for detection (not `onSuccess` callback)?**
Celebrations should trigger for ANY change that crosses a milestone — contributions, target_amount edits, or data loaded from another device. The `useRef` pattern catches all cases uniformly. The `ContributionModal.onSuccess` only fires for contributions.

**Why not `useCallback` wrapping `onMilestoneOpen` in deps?**
The `onMilestoneOpen` from `useDisclosure()` is stable (same reference across renders). Including it in deps is correct by the rules of hooks but won't cause infinite loops.

**Confetti containment:**
Add `overflow="hidden"` to `ModalContent` and `position="relative"` to the confetti container `Box`, so confetti pieces don't visually escape the overlay bounds. Pieces use `position="absolute"` within the container.

**Only one milestone at a time:**
The `useEffect` breaks after finding the first uncelebrated crossing. If a user goes from 0% to 60% in one contribution, only the 50% milestone fires. The 25% milestone was already in `milestones_celebrated` (marked when it was first crossed).

Actually wait — if the user goes from 0% to 60% in ONE contribution (skipping 25% entirely), both 25% and 50% are new. We only show the higher one (50%) with the `break`. This is the intended behavior per UX — never stack more than 1 celebration at a time.

**The `milestones_celebrated` type in `Goal`:**
The Supabase DB returns `INTEGER[]` as `number[]` in the JavaScript client. No transformation needed.

**`markMilestoneCelebrated` idempotency:**
The service function checks if `threshold` is already in the array before updating. This means even if the client calls it multiple times (e.g., network retry), it's safe. This is important for the fire-and-forget pattern in GoalCard.

### File Structure Requirements

```
supabase/
└── migrations/
    └── 014_goal_milestones.sql             # NEW — ALTER TABLE goals ADD COLUMN

src/
├── types/
│   └── database.types.ts                  # MODIFY — add milestones_celebrated to Goal
├── lib/
│   └── services/
│       ├── goalService.ts                  # MODIFY — add markMilestoneCelebrated
│       └── __tests__/
│           └── goalService.test.ts         # MODIFY — add markMilestoneCelebrated tests
├── app/
│   └── api/
│       └── goals/
│           └── [id]/
│               └── celebrate/
│                   ├── route.ts            # NEW — POST /api/goals/[id]/celebrate
│                   └── __tests__/
│                       └── celebrate.test.ts  # NEW
└── components/
    └── goals/
        ├── MilestoneOverlay.tsx            # NEW
        ├── GoalCard.tsx                    # MODIFY — add milestone detection + overlay + badge
        └── __tests__/
            ├── MilestoneOverlay.test.tsx   # NEW
            └── GoalCard.test.tsx           # MODIFY — add milestones_celebrated to sampleGoal + new tests

messages/
├── en.json                                 # MODIFY — add 6 new goals.milestone* keys
└── bg.json                                 # MODIFY — same structure, Bulgarian translations
```

### Testing Requirements

- **`@jest-environment node`** on `celebrate.test.ts` API test
- **Mock `useReducedMotion`** in `MilestoneOverlay.test.tsx`:
  ```typescript
  jest.mock('framer-motion', () => ({
    ...jest.requireActual('framer-motion'),
    useReducedMotion: jest.fn(),
    motion: { div: ({ children, ...props }: React.PropsWithChildren<object>) => <div {...props}>{children}</div> },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }));
  ```
- **Mock timers** for auto-dismiss test: `jest.useFakeTimers()` → `act(() => jest.advanceTimersByTime(4000))` → assert `onClose` called
- **`noUncheckedIndexedAccess`**: if accessing `goal.milestones_celebrated[0]`, add `!` with eslint-disable comment
- **ChakraProvider wrap** on all component tests
- **Existing GoalCard.test.tsx**: add `milestones_celebrated: []` to `sampleGoal` — the TypeScript compiler WILL error if this field is missing after the Goal type update

### Previous Story Intelligence (Story 11.5)

- **`useRef` is already used in GoalCard** for `cancelDeleteRef` — adding `prevPercentageRef` and `justTriggeredRef` follows the same pattern
- **Zod v4 compatibility**: use `error:` not `invalid_type_error:` in `z.number()` schemas
- **Three-step Supabase pattern in service**: read → check → update (same as `addContribution`) for `markMilestoneCelebrated`
- **`createDeleteChainMock` pattern** (first `.eq()` returns chain, second resolves): For `markMilestoneCelebrated` service test mocks, use `createSingleChainMock` for the SELECT and a separate chain for the UPDATE
- **Chakra `AlertDialog`** was introduced in GoalCard; `Modal` for MilestoneOverlay uses same import pattern but without `leastDestructiveRef`
- **GoalForm** `isOpen` in `useEffect` deps was a code review fix — note this pattern: always include `isOpen` in deps when resetting on modal open

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 11.6 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-020: Gamification Component Strategy — animations respect prefers-reduced-motion]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013: Goal & Wishlist Model]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Line 376-380: MilestoneOverlay UX spec (full-screen, 4s auto-dismiss, confetti, reduced-motion fallback)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Line 295: MilestoneToast component spec]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Line 815-818: MilestoneOverlay composition]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Line 1046: Milestone accessibility requirements (aria-live assertive, static badge fallback)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Line 205: Confetti/animation inspiration from Duolingo]
- [Source: _bmad-output/implementation-artifacts/11-5-savings-goals.md — Complete GoalCard structure, Goal type, goalService patterns, API auth pattern]
- [Source: src/components/goals/GoalCard.tsx — Integration point for MilestoneOverlay and detection logic]
- [Source: src/components/goals/GoalProgress.tsx — formatAmount helper pattern to copy into MilestoneOverlay]
- [Source: src/app/api/goals/[id]/contribute/route.ts — Celebrate route pattern (Next.js 15 async params)]
- [Source: src/lib/services/goalService.ts — PGRST116 constant, addContribution three-step pattern for markMilestoneCelebrated]
- [Source: package.json — framer-motion@10.16.0 already installed; useReducedMotion available]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- MilestoneOverlay test required local `@chakra-ui/react` mock to avoid global jest.setup mock's `requireActual` triggering emotion `__emotion_real` error when framer-motion is also mocked. Root cause: jest.mock('framer-motion') invalidates module cache state used by global chakra mock's requireActual.
- `sampleGoal` updated with `milestones_celebrated: []` in 5 test files (GoalCard, GoalForm, goals.test, goals-id.test, goalService.test).

### Completion Notes List

- All 7 tasks complete with all subtasks implemented.
- 94 goals-related tests pass (10 new in celebrate.test, 4 new in markMilestoneCelebrated service tests, 10 new in MilestoneOverlay.test, 3 new in GoalCard.test + existing tests updated).
- `milestones_celebrated` i18n key `milestoneMessage` uses `{goalName}` and `{percentage}` parameters (note: story spec had `{ goalName }` only — added `percentage` to match the message format).
- framer-motion mock pattern: mock WITHOUT `jest.requireActual` to avoid emotion initialization conflict. Only mock `useReducedMotion`, `motion.div`, `AnimatePresence`.

### File List

- `supabase/migrations/014_goal_milestones.sql` — NEW: ALTER TABLE goals ADD COLUMN milestones_celebrated
- `src/types/database.types.ts` — MODIFIED: added milestones_celebrated to Goal interface
- `src/lib/services/goalService.ts` — MODIFIED: added markMilestoneCelebrated function
- `src/lib/services/__tests__/goalService.test.ts` — MODIFIED: added markMilestoneCelebrated tests, updated sampleGoal
- `src/app/api/goals/[id]/celebrate/route.ts` — NEW: POST /api/goals/[id]/celebrate
- `src/app/api/goals/[id]/celebrate/__tests__/celebrate.test.ts` — NEW
- `src/components/goals/MilestoneOverlay.tsx` — NEW
- `src/components/goals/__tests__/MilestoneOverlay.test.tsx` — NEW
- `src/components/goals/GoalCard.tsx` — MODIFIED: milestone detection useEffect, permanent badge, MilestoneOverlay render
- `src/components/goals/__tests__/GoalCard.test.tsx` — MODIFIED: MilestoneOverlay mock, milestone badge tests, updated sampleGoal
- `src/components/goals/__tests__/GoalForm.test.tsx` — MODIFIED: updated sampleGoal
- `src/app/api/goals/__tests__/goals.test.ts` — MODIFIED: updated sampleGoal
- `src/app/api/goals/[id]/__tests__/goals-id.test.ts` — MODIFIED: updated sampleGoal
- `src/app/api/goals/[id]/contribute/__tests__/contribute.test.ts` — MODIFIED: added milestones_celebrated to updatedGoal fixture
- `src/app/goals/page.tsx` — MODIFIED: stabilised onMutate with useCallback (M4 — prevents milestone useEffect re-running on every parent render)
- `messages/en.json` — MODIFIED: 6 new goals.milestone* keys
- `messages/bg.json` — MODIFIED: 6 new goals.milestone* keys
