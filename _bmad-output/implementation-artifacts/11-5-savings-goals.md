# Story 11.5: Savings Goals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user saving toward specific targets,
I want to create savings goals with target amounts and deadlines,
so that I can track progress toward financial milestones.

## Acceptance Criteria

1. **Given** a logged-in user on the Goals page, **When** they click "Create Goal", **Then** a modal opens where they can set a goal name (required), target amount (required, > 0), and optional deadline; submitting creates the goal and shows it in the goals list.

2. **Given** a user has one or more goals, **When** they view the Goals page, **Then** each goal displays: name, a visual progress bar showing current_amount / target_amount, amounts formatted in the user's currency, and the deadline (or "No deadline" if not set).

3. **Given** a user views an existing goal, **When** they click "Add Contribution" and enter an amount (> 0) with optional note, **Then** the goal's current_amount increases by that amount and the progress bar updates.

4. **Given** a user has no goals yet, **When** they view the Goals page, **Then** an empty state is shown: "Set your first savings goal" with a "Create Goal" button.

5. **Given** a user views the Goals page, **When** they click "Edit" on a goal, **Then** the goal form opens pre-filled; saving updates the goal name, target amount, and/or deadline.

6. **Given** a user views the Goals page, **When** they click "Delete" on a goal, **Then** a confirmation is required before the goal (and all its contributions) is permanently deleted.

7. **Given** a goal's current_amount ≥ target_amount, **When** the goal card renders, **Then** a "Completed!" badge is shown and the progress bar is full/green.

8. **Given** a user navigates the app, **When** they look at the sidebar, **Then** a "Goals" nav item is present after "Categories", linking to `/goals`.

9. **Given** amounts are rendered anywhere on the Goals page, **When** they display, **Then** they use the user's configured currency (from `useUserPreferences()`) — no hardcoded currency symbols.

10. **Given** data is loading, **When** `isLoading` is true, **Then** skeleton placeholders matching the goal card shape are shown.

## Tasks / Subtasks

- [x] Task 1: Database migration (AC: all)
  - [x] 1.1 Create `supabase/migrations/013_goals.sql`
    - `goals` table: `id UUID DEFAULT uuid_generate_v4() PRIMARY KEY`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`, `name TEXT NOT NULL`, `target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0)`, `current_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0)`, `deadline DATE` (nullable), `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`
    - `goal_contributions` table: `id UUID DEFAULT uuid_generate_v4() PRIMARY KEY`, `goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`, `amount DECIMAL(12,2) NOT NULL CHECK (amount > 0)`, `note TEXT` (nullable), `created_at TIMESTAMPTZ DEFAULT now()`
    - RLS on both tables: SELECT/INSERT/UPDATE/DELETE using `auth.uid() = user_id`
    - `goal_contributions` DELETE policy also allows via goal owner: check `auth.uid() = user_id`
    - Indexes: `idx_goals_user_id ON goals(user_id)`, `idx_goal_contributions_goal_id ON goal_contributions(goal_id)`, `idx_goal_contributions_user_id ON goal_contributions(user_id)`
    - Auto-update trigger for `goals.updated_at` (same pattern as migration 012)
    - Include table COMMENTs (same style as migration 012)

- [x] Task 2: TypeScript types (AC: all)
  - [x] 2.1 Add `// GOAL TYPES (Story 11.5)` section to `src/types/database.types.ts`
    ```typescript
    export interface Goal {
      id: string;
      user_id: string;
      name: string;
      target_amount: number;
      current_amount: number;
      deadline: string | null;  // YYYY-MM-DD or null
      created_at: string;
      updated_at: string;
    }

    export interface GoalContribution {
      id: string;
      goal_id: string;
      user_id: string;
      amount: number;
      note: string | null;
      created_at: string;
    }

    export interface CreateGoalInput {
      name: string;
      target_amount: number;
      deadline?: string | null;  // YYYY-MM-DD or null
    }

    export interface UpdateGoalInput {
      name?: string;
      target_amount?: number;
      deadline?: string | null;
    }

    export interface AddContributionInput {
      amount: number;
      note?: string | null;
    }

    export interface GoalsListResponse {
      goals: Goal[];
    }
    ```

- [x] Task 3: Goal service (AC: #1, #2, #3, #5, #6)
  - [x] 3.1 Create `src/lib/services/goalService.ts`
  - [x] 3.2 Implement `getGoals(supabase, userId)`:
    ```typescript
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
    ```
  - [x] 3.3 Implement `createGoal(supabase, userId, input: CreateGoalInput)`:
    - INSERT: `{ user_id: userId, name: input.name, target_amount: input.target_amount, deadline: input.deadline ?? null }`
    - `.select().single()` to return created row
    - Throw on error
  - [x] 3.4 Implement `updateGoal(supabase, userId, goalId, updates: UpdateGoalInput)`:
    - UPDATE with `.eq('id', goalId).eq('user_id', userId)` (double-check ownership)
    - `.select().single()` to return updated row
    - Throw on error; throw if no row matched (goal not found / not owned by user)
  - [x] 3.5 Implement `deleteGoal(supabase, userId, goalId)`:
    - DELETE with `.eq('id', goalId).eq('user_id', userId)`
    - Cascade deletes goal_contributions automatically (via FK ON DELETE CASCADE)
    - Throw on error
  - [x] 3.6 Implement `getGoal(supabase, userId, goalId)`:
    - SELECT single goal with `.eq('id', goalId).eq('user_id', userId).single()`
    - Return `data` (Goal or null if not found)
    - Throw on DB error; return null if `error?.code === 'PGRST116'` (PostgREST "row not found" code)

  - [x] 3.7 Implement `addContribution(supabase, userId, goalId, input: AddContributionInput)`:
    - Step 1: INSERT into `goal_contributions` `{ goal_id: goalId, user_id: userId, amount: input.amount, note: input.note ?? null }`
    - Step 2: UPDATE `goals` SET `current_amount = current_amount + input.amount` WHERE `id = goalId AND user_id = userId`
      ```typescript
      // Use rpc or two-step: insert contribution then increment current_amount
      const { error: contribError } = await supabase
        .from('goal_contributions')
        .insert({ goal_id: goalId, user_id: userId, amount: input.amount, note: input.note ?? null });
      if (contribError) throw contribError;

      const { data: current } = await supabase
        .from('goals')
        .select('current_amount')
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();
      if (!current) throw new Error('Goal not found');

      const { error: updateError } = await supabase
        .from('goals')
        .update({ current_amount: Number(current.current_amount) + Number(input.amount) })
        .eq('id', goalId)
        .eq('user_id', userId);
      if (updateError) throw updateError;
      ```
    - Return the updated goal (re-fetch after update)

- [x] Task 4: API routes (AC: #1, #2, #3, #5, #6)
  - [x] 4.1 Create `src/app/api/goals/route.ts`:
    - `export const dynamic = 'force-dynamic'; export const revalidate = 0;`
    - `GET /api/goals`: auth → `getGoals(supabase, user.id)` → return `{ goals }` with status 200
    - `POST /api/goals`: auth → parse body (`name`, `target_amount`, `deadline?`) → validate (name non-empty, target_amount > 0, deadline either null or a valid future ISO date string) → `createGoal(supabase, user.id, input)` → return created goal with status 201
    - 400 on validation failure with `{ error: { message: 'validation error description' } }`
    - 500 on caught error with `{ error: { message: 'Failed to manage goals' } }`
  - [x] 4.2 Create `src/app/api/goals/[id]/route.ts`:
    - `GET /api/goals/[id]`: auth → `getGoal(supabase, user.id, id)` → 404 if not found → return goal
    - `PUT /api/goals/[id]`: auth → parse body → validate same rules as POST → `updateGoal` → return updated goal
    - `DELETE /api/goals/[id]`: auth → `deleteGoal(supabase, user.id, id)` → return `{ success: true }` status 200
    - 404 when goal not found: `const goal = await getGoal(supabase, user.id, id); if (!goal) return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 });`
    - Use `getGoal` from goalService (Task 3.6)
  - [x] 4.3 Create `src/app/api/goals/[id]/contribute/route.ts`:
    - `POST /api/goals/[id]/contribute`: auth → parse body (`amount`, `note?`) → validate (amount > 0) → `addContribution(supabase, user.id, id, input)` → return updated goal with status 200
    - 400 on validation failure; 404 if goal not found; 500 on error

- [x] Task 5: SWR hook (AC: #2, #4, #10)
  - [x] 5.1 Create `src/lib/hooks/useGoals.ts`:
    ```typescript
    import useSWR, { type KeyedMutator } from 'swr';
    import type { Goal, GoalsListResponse } from '@/types/database.types';

    interface UseGoalsResult {
      goals: Goal[];
      isLoading: boolean;
      error: Error | undefined;
      mutate: KeyedMutator<GoalsListResponse>;
    }

    export function useGoals(): UseGoalsResult {
      const { data, error, isLoading, mutate } = useSWR<GoalsListResponse>(
        '/api/goals',
        async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch goals');
          return response.json();
        }
      );
      return {
        goals: data?.goals ?? [],
        isLoading,
        error,
        mutate,
      };
    }
    ```

- [x] Task 6: Components (AC: #1, #2, #3, #4, #5, #6, #7, #9, #10)
  - [x] 6.1 Create `src/components/goals/GoalProgress.tsx`:
    - Props: `currentAmount: number`, `targetAmount: number`, `currency: string`
    - Compute `percentage = Math.min(100, Math.round((currentAmount / targetAmount) * 100))`
    - Render Chakra `Progress` component: `value={percentage}`, `colorScheme={percentage >= 100 ? 'green' : 'blue'}`
    - Show `{percentage}% complete` as text below bar
    - Show "Completed!" `Badge` (colorScheme="green") when percentage >= 100
    - Format amounts with `Intl.NumberFormat` (same `formatAmount` helper as AnnualizedProjections — copy or extract to shared utility)
    - Display: `{formatAmount(currentAmount, currency)} / {formatAmount(targetAmount, currency)}`

  - [x] 6.2 Create `src/components/goals/GoalForm.tsx`:
    - Props: `isOpen: boolean`, `onClose: () => void`, `onSuccess: (goal: Goal) => void`, `existingGoal?: Goal` (undefined = create mode, defined = edit mode)
    - Use `react-hook-form` + `zodResolver` (same pattern as CategoryModal)
    - Zod schema:
      ```typescript
      const goalSchema = z.object({
        name: z.string().min(1, 'Goal name is required').max(200).trim(),
        target_amount: z.number({ invalid_type_error: 'Amount required' }).positive('Must be greater than 0'),
        deadline: z.string().optional().nullable(),  // YYYY-MM-DD string or null
      });
      ```
    - Deadline field: `<Input type="date" .../>` — if provided, validate it's a future date in the schema refinement:
      ```typescript
      .refine((val) => !val || new Date(val) > new Date(), { message: 'Deadline must be in the future', path: ['deadline'] })
      ```
    - Edit mode: pre-fill with `existingGoal` data via `useEffect` + `reset()`
    - On submit:
      - Create mode: `POST /api/goals` → on success: call `onSuccess(createdGoal)`, show toast, close
      - Edit mode: `PUT /api/goals/{existingGoal.id}` → on success: call `onSuccess(updatedGoal)`, show toast, close
    - Loading state: disable submit button, show spinner
    - Use `t('goals.form.*')` for labels

  - [x] 6.3 Create `src/components/goals/ContributionModal.tsx`:
    - Props: `isOpen: boolean`, `onClose: () => void`, `goalId: string`, `goalName: string`, `onSuccess: () => void`
    - Use `react-hook-form` + `zodResolver`:
      ```typescript
      const contributionSchema = z.object({
        amount: z.number({ invalid_type_error: 'Amount required' }).positive('Must be greater than 0'),
        note: z.string().optional().nullable(),
      });
      ```
    - On submit: `POST /api/goals/{goalId}/contribute` with `{ amount, note }`
    - On success: call `onSuccess()`, show toast, close modal
    - Use `t('goals.contribution.*')` for labels

  - [x] 6.4 Create `src/components/goals/GoalCard.tsx`:
    - Props: `goal: Goal`, `currency: string`, `onMutate: () => void`
    - Use `useDisclosure()` for contribution modal
    - Use `useDisclosure()` for edit form (pass `goal` as `existingGoal`)
    - Delete: use a Chakra `useDisclosure()` + `AlertDialog` for delete confirmation (Chakra `AlertDialog` is accessible, already used in existing modals — do NOT use `window.confirm` which is not accessible or stylable). Pattern:
      ```tsx
      const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
      // AlertDialog with "Delete" confirm / "Cancel" cancel buttons
      // leastDestructiveRef pointing to the Cancel button (required by AlertDialog)
      ```
    - Layout:
      ```tsx
      <Card>
        <CardHeader>
          <HStack justify="space-between">
            <Heading size="md">{goal.name}</Heading>
            {isCompleted && <Badge colorScheme="green">{t('goals.completed')}</Badge>}
            <HStack>
              <IconButton aria-label="Edit goal" icon={<EditIcon />} size="sm" onClick={onEditOpen} />
              <IconButton aria-label="Delete goal" icon={<DeleteIcon />} size="sm" colorScheme="red" variant="ghost" onClick={handleDelete} />
            </HStack>
          </HStack>
        </CardHeader>
        <CardBody>
          <GoalProgress currentAmount={goal.current_amount} targetAmount={goal.target_amount} currency={currency} />
          {goal.deadline && <Text fontSize="sm" color="gray.500">{t('goals.deadline')}: {goal.deadline}</Text>}
          {!goal.deadline && <Text fontSize="sm" color="gray.400">{t('goals.noDeadline')}</Text>}
          <Button mt={3} size="sm" colorScheme="blue" onClick={onContribOpen}>{t('goals.addContribution')}</Button>
        </CardBody>
        {/* GoalForm for edit */}
        <GoalForm isOpen={isEditOpen} onClose={onEditClose} existingGoal={goal} onSuccess={() => { onEditClose(); onMutate(); }} />
        {/* ContributionModal */}
        <ContributionModal isOpen={isContribOpen} onClose={onContribClose} goalId={goal.id} goalName={goal.name} onSuccess={() => { onContribClose(); onMutate(); }} />
      </Card>
      ```
    - Delete handler: confirm with toast on success; call `DELETE /api/goals/{goal.id}` then `onMutate()`
    - `isCompleted = goal.current_amount >= goal.target_amount`

- [x] Task 7: Goals page (AC: #1, #2, #3, #4, #5, #6, #7, #8, #10)
  - [x] 7.1 Create `src/app/goals/page.tsx`:
    - `'use client'` directive
    - Import: `AppLayout`, `useGoals`, `useUserPreferences`, `GoalCard`, `GoalForm`, Chakra components, `useTranslations`
    - Use `useDisclosure()` for create modal
    - Use `useGoals()` for data; `const currency = preferences?.currency_format ?? ''`
    - Loading: render `{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height="160px" borderRadius="md" />)}` when `isLoading`
    - Empty state (when `!isLoading && goals.length === 0`):
      ```tsx
      <VStack py={12} spacing={4} align="center">
        <Text color="gray.500" fontSize="lg">{t('goals.emptyState')}</Text>
        <Text color="gray.400" fontSize="sm">{t('goals.emptyStateSubtitle')}</Text>
        <Button colorScheme="blue" onClick={onOpen}>{t('goals.createGoal')}</Button>
      </VStack>
      ```
    - Goals grid (when goals.length > 0):
      ```tsx
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} currency={currency} onMutate={mutate} />
        ))}
      </SimpleGrid>
      ```
    - Page header: `<Heading as="h1">{t('goals.title')}</Heading>` + `<Button colorScheme="blue" onClick={onOpen}>{t('goals.createGoal')}</Button>` (top-right aligned)
    - GoalForm create modal: `<GoalForm isOpen={isOpen} onClose={onClose} onSuccess={(newGoal) => { onClose(); mutate(); }} />`
    - Wrap in `<AppLayout>`

- [x] Task 8: Navigation (AC: #8)
  - [x] 8.1 Modify `src/components/layout/Sidebar.tsx`:
    - Import `StarIcon` from `@chakra-ui/icons`
    - Add to `navItemKeys` array after `categories` entry:
      ```typescript
      { key: 'goals' as const, href: '/goals', icon: StarIcon },
      ```
    - Update the type union: `'dashboard' | 'transactions' | 'categories' | 'goals' | 'insights' | 'settings'`
  - [x] 8.2 Add `"goals": "Goals"` to `messages/en.json` under `navigation` (after `"categories"`)
  - [x] 8.3 Add `"goals": "Цели"` to `messages/bg.json` under `navigation` (after `"categories"`)
  - [x] Note: BottomNav restructure (Dashboard/Transactions/Goals/More pattern from UX) is **deferred** to a later story — modifying BottomNav now would remove Insights and Settings from mobile nav prematurely

- [x] Task 9: i18n strings (AC: all)
  - [x] 9.1 Add `goals` namespace to `messages/en.json`:
    ```json
    "goals": {
      "title": "Savings Goals",
      "createGoal": "Create Goal",
      "editGoal": "Edit Goal",
      "emptyState": "Set your first savings goal",
      "emptyStateSubtitle": "Track your progress toward financial milestones",
      "saved": "Saved",
      "target": "Target",
      "deadline": "Deadline",
      "noDeadline": "No deadline",
      "progress": "{percentage}% complete",
      "addContribution": "Add Contribution",
      "completed": "Completed!",
      "name": "Goal Name",
      "namePlaceholder": "e.g. Emergency Fund",
      "targetAmount": "Target Amount",
      "deadlineOptional": "Deadline (optional)",
      "save": "Save",
      "cancel": "Cancel",
      "contributionTitle": "Add Contribution",
      "contributionAmount": "Amount",
      "contributionNote": "Note (optional)",
      "contributionNotePlaceholder": "e.g. Monthly savings",
      "add": "Add",
      "createSuccess": "Goal created",
      "updateSuccess": "Goal updated",
      "deleteSuccess": "Goal deleted",
      "contributeSuccess": "Contribution added"
    }
    ```
  - [x] 9.2 Add the same keys to `messages/bg.json` with Bulgarian translations:
    ```json
    "goals": {
      "title": "Цели за спестявания",
      "createGoal": "Създай цел",
      "editGoal": "Редактирай цел",
      "emptyState": "Задайте първата си цел за спестявания",
      "emptyStateSubtitle": "Проследявайте напредъка към финансовите си цели",
      "saved": "Спестено",
      "target": "Цел",
      "deadline": "Краен срок",
      "noDeadline": "Без краен срок",
      "progress": "{percentage}% завършено",
      "addContribution": "Добави вноска",
      "completed": "Завършено!",
      "name": "Наименование на целта",
      "namePlaceholder": "напр. Авариен фонд",
      "targetAmount": "Целева сума",
      "deadlineOptional": "Краен срок (незадължително)",
      "save": "Запази",
      "cancel": "Откажи",
      "contributionTitle": "Добави вноска",
      "contributionAmount": "Сума",
      "contributionNote": "Бележка (незадължително)",
      "contributionNotePlaceholder": "напр. Месечни спестявания",
      "add": "Добави",
      "createSuccess": "Целта е създадена",
      "updateSuccess": "Целта е обновена",
      "deleteSuccess": "Целта е изтрита",
      "contributeSuccess": "Вноската е добавена"
    }
    ```
  - [x] 9.3 No keys in the goals namespace are identical between locales (all are fully translated), so no translations test allowlist changes needed

- [x] Task 10: Tests (AC: all)
  - [x] 10.1 Unit tests at `src/lib/services/__tests__/goalService.test.ts`:
    - Use chainable mock helpers (same `createOrderChainMock`, etc. patterns from `projectionsService.test.ts`)
    - **`getGoals`**: returns empty array when no goals, returns goals sorted by created_at desc, throws on DB error
    - **`createGoal`**: inserts correct fields (user_id, name, target_amount, deadline), returns created goal, throws on DB error
    - **`updateGoal`**: calls update with correct fields and ownership filter (eq user_id + eq id), throws on DB error
    - **`deleteGoal`**: calls delete with correct ownership filter, throws on DB error
    - **`addContribution`**: inserts contribution with correct fields, updates goal current_amount = old + new, throws on insert error (does not update goal), throws on goal-not-found after insert
    - Chain for getGoals/updateGoal/deleteGoal ends at `.order()` or `.single()`; for `addContribution` the contribution insert ends at `.insert()` resolved value; build chain mocks accordingly
    - Test file uses `// @jest-environment jsdom` (default, same as other service tests)

  - [x] 10.2 Integration tests at `src/app/api/goals/__tests__/goals.test.ts`:
    - `@jest-environment node`, mock `next/server` + `@/lib/supabase/server` + `@/lib/services/goalService` + `@/lib/utils/logger` before imports (same pattern as `annualized-projections.test.ts`)
    - **GET /api/goals**: 401 without auth, returns `{ goals }` for authenticated user, returns 500 on service error
    - **POST /api/goals**: 401 without auth, 400 on missing name, 400 on target_amount ≤ 0, 400 on past deadline, 201 with created goal on valid input, 500 on service error

  - [x] 10.3 Integration tests at `src/app/api/goals/[id]/__tests__/goals-id.test.ts`:
    - `@jest-environment node`, same mock setup
    - **GET /api/goals/[id]**: 401 without auth, returns goal for authenticated user, 404 when `getGoal` returns null, 500 on error
    - **PUT /api/goals/[id]**: 401 without auth, 400 on invalid input, 200 with updated goal, 500 on error
    - **DELETE /api/goals/[id]**: 401 without auth, returns `{ success: true }` for authenticated user, 500 on error

  - [x] 10.4 Integration tests at `src/app/api/goals/[id]/contribute/__tests__/contribute.test.ts`:
    - `@jest-environment node`, same mock setup
    - **POST /api/goals/[id]/contribute**: 401 without auth, 400 on amount ≤ 0, 200 with updated goal on valid contribution, 500 on service error

  - [x] 10.5 Component tests at `src/components/goals/__tests__/GoalCard.test.tsx`:
    - Mock `useUserPreferences`, `next-intl` (same pattern as AnnualizedProjections test)
    - **GoalCard renders goal name**
    - **GoalCard renders progress bar with correct percentage**
    - **GoalCard shows "Completed!" badge when current_amount ≥ target_amount**
    - **GoalCard shows deadline when present**
    - **GoalCard shows "No deadline" when deadline is null**
    - **GoalCard "Add Contribution" button is present**
    - **GoalCard "Edit" button is present**
    - **GoalCard "Delete" button is present**
    - Wrap in `<ChakraProvider>`

  - [x] 10.6 Component tests at `src/components/goals/__tests__/GoalForm.test.tsx`:
    - Mock `next-intl`, `react-hook-form` usage
    - **GoalForm renders create mode title when no existingGoal**
    - **GoalForm renders edit mode title when existingGoal provided**
    - **GoalForm shows name input, target amount input, deadline input**
    - **GoalForm submit button disabled while loading**
    - Wrap in `<ChakraProvider>`

## Dev Notes

### Current State (What Exists)

**Existing pages structure** — goals follows the TOP-LEVEL route pattern, NOT the `(dashboard)` group:
- `src/app/dashboard/page.tsx` — top-level
- `src/app/transactions/page.tsx` — top-level
- `src/app/categories/page.tsx` — top-level
- `src/app/insights/page.tsx` — top-level
- `src/app/(dashboard)/settings/page.tsx` — in `(dashboard)` group (legacy, only settings uses this)
- **Goals page must go at `src/app/goals/page.tsx`** (top-level, matching the established pattern)

**Sidebar** (`src/components/layout/Sidebar.tsx`):
- Currently: dashboard, transactions, categories, insights, settings
- Goals goes AFTER categories, BEFORE insights
- Key is `'goals' as const` — the type union of allowed keys must be updated
- Icon: `StarIcon` from `@chakra-ui/icons` (already available, no new package needed)
- `useTranslations('navigation')` is already used — just add `"goals"` key to the namespace

**BottomNav** — DO NOT MODIFY in this story:
- UX spec says Phase 2 BottomNav should be: Dashboard, Transactions, Goals, More
- But changing BottomNav now removes Insights and Settings from mobile nav prematurely
- Story 11.7 or a dedicated nav-restructure story should handle BottomNav Phase 2 migration

**Modal pattern** — matches `CategoryModal.tsx`:
- `react-hook-form` + `zodResolver` + Chakra Modal components
- `useToast()` for success/error feedback
- `const toast = useToast(); toast({ title, status, duration: 5000, isClosable: true })`
- `useDisclosure()` in the parent page for open/close control

**formatAmount helper** — currently duplicated in `HeatmapGrid.tsx` and `AnnualizedProjections.tsx`:
```typescript
function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
```
Copy this pattern into GoalProgress.tsx — do NOT extract to a shared utility (no shared utility needed per project conventions; each component owns its formatter).

**Supabase RPC vs two-step for addContribution** — the codebase has no existing RPC usage. Do NOT create an RPC function. Use the two-step pattern (insert contribution + fetch current + update amount). This is safe for a single-user app where race conditions are negligible.

**`uuid_generate_v4()`** — used in migrations 001–012; use same function (NOT `gen_random_uuid()`) for consistency.

### What Changes

1. **New migration**: `supabase/migrations/013_goals.sql` — `goals` + `goal_contributions` tables with RLS
2. **New types**: `src/types/database.types.ts` — Goal, GoalContribution, CreateGoalInput, UpdateGoalInput, AddContributionInput, GoalsListResponse
3. **New service**: `src/lib/services/goalService.ts`
4. **New API routes**: `src/app/api/goals/route.ts`, `src/app/api/goals/[id]/route.ts`, `src/app/api/goals/[id]/contribute/route.ts`
5. **New hook**: `src/lib/hooks/useGoals.ts`
6. **New components**: `src/components/goals/GoalProgress.tsx`, `GoalCard.tsx`, `GoalForm.tsx`, `ContributionModal.tsx`
7. **New page**: `src/app/goals/page.tsx`
8. **Modified**: `src/components/layout/Sidebar.tsx` — add Goals nav item
9. **Modified**: `messages/en.json` + `messages/bg.json` — add `navigation.goals` + `goals` namespace

### Architecture Compliance

Carry forward ALL lessons from Stories 11.2–11.4:

1. **Service functions accept Supabase client as parameter (NEVER create their own)** — M1 from 11.2
2. **No hardcoded currency** — `preferences?.currency_format ?? ''` with empty-string guard in formatAmount
3. **DB errors throw** — `if (error) throw error;` throughout goalService.ts
4. **Consistent API response shapes** — all success and error responses follow established shapes
5. **No `!` non-null assertions** in source files — use `?.` optional chaining
6. **`KeyedMutator<T>` return type** on mutate in useGoals.ts hook interface
7. **No unused i18n keys** — verify every key in `goals` namespace is `t()`'d in a component
8. **`export const dynamic = 'force-dynamic'; export const revalidate = 0;`** on all new API routes
9. **Auth pattern**: `createClient()` → `supabase.auth.getUser()` → 401 if no session (exact pattern from every existing route)
10. **Error response shape**: `{ error: { message: '...' } }` with status code — consistent with subscriptions/heatmap/projections routes

### Input Validation Rules (API layer)

- `name`: required string, non-empty after trim
- `target_amount`: must be a positive number (> 0); parse as `Number(body.target_amount)` then check `isNaN()` and `<= 0`
- `deadline`: optional; if provided, must be a valid date string (ISO format `YYYY-MM-DD`) and must be strictly after today's date
  - Validation: `new Date(deadline).setHours(0,0,0,0) > new Date().setHours(0,0,0,0)`
  - Null is valid (no deadline)
- `amount` (contributions): must be a positive number > 0
- `note` (contributions): optional string, may be null/undefined

### File Structure Requirements

```
supabase/
└── migrations/
    └── 013_goals.sql                          # NEW

src/
├── types/
│   └── database.types.ts                      # MODIFY — add Goal types section
├── lib/
│   ├── services/
│   │   ├── goalService.ts                     # NEW
│   │   └── __tests__/
│   │       └── goalService.test.ts            # NEW
│   └── hooks/
│       └── useGoals.ts                        # NEW
├── components/
│   └── goals/                                 # NEW directory
│       ├── GoalProgress.tsx                   # NEW
│       ├── GoalCard.tsx                       # NEW
│       ├── GoalForm.tsx                       # NEW
│       ├── ContributionModal.tsx              # NEW
│       └── __tests__/
│           ├── GoalCard.test.tsx              # NEW
│           └── GoalForm.test.tsx              # NEW
└── app/
    ├── goals/
    │   └── page.tsx                           # NEW — /goals page
    └── api/
        └── goals/
            ├── route.ts                       # NEW — GET list + POST create
            ├── __tests__/
            │   └── goals.test.ts              # NEW
            └── [id]/
                ├── route.ts                   # NEW — GET + PUT + DELETE
                ├── __tests__/
                │   └── goals-id.test.ts       # NEW
                └── contribute/
                    ├── route.ts               # NEW — POST contribution
                    └── __tests__/
                        └── contribute.test.ts # NEW

src/components/layout/
└── Sidebar.tsx                                # MODIFY — add Goals nav item

messages/
├── en.json                                    # MODIFY — navigation.goals + goals namespace
└── bg.json                                    # MODIFY — navigation.goals + goals namespace
```

### Testing Requirements

- **`@jest-environment node`** on all 4 API integration test files — mock `next/server` before ALL imports (same as `annualized-projections.test.ts` pattern: `jest.mock(...)` → `jest.mock(...)` → imports)
- **Service test mocks**: `goalService.ts` uses `.select('*').eq().order()` → use `createOrderChainMock` variant; for `addContribution` the contribution INSERT has a simpler chain (`.insert()` as terminal on `goal_contributions`), goal SELECT ends in `.single()`, goal UPDATE ends in `.eq()` update
- **ChakraProvider wrap**: all component tests wrapped in `<ChakraProvider>`
- **Mock `useUserPreferences`** in component tests with `{ preferences: { currency_format: 'EUR' }, isLoading: false, error: undefined }`
- **Mock `useGoals`** in GoalCard tests — GoalCard does not use useGoals directly (it receives `goal` as prop), so no hook mock needed for GoalCard tests
- **Mock `next-intl`** with `useTranslations` returning flat key→label map
- **`noUncheckedIndexedAccess`**: any direct array index access (`goals[0]`) in test files needs `!` assertion with `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion` comment above it

### Previous Story Intelligence

**From Story 11.4 code review (apply all):**
1. `fmt()` timezone fix — use `getFullYear()/getMonth()/getDate()` local components (not `toISOString()`) for any date formatting in service layer
2. No `!` assertions in source files — use `?.` optional chaining
3. `KeyedMutator<T>` type in hook interface
4. `data-testid` on skeleton elements for test targeting: use `data-testid="goal-skeleton"` for skeleton cards in GoalCard/Goals page

**From CategoryModal.tsx (follow exactly for GoalForm):**
- `react-hook-form` + `zodResolver` + Zod schema validation
- `useEffect(() => { reset(formData); }, [existingGoal, reset])` for pre-filling edit form
- `finally { setIsSubmitting(false); }` pattern around async submit
- `toast({ title, status: 'success'/'error', duration: 5000, isClosable: true })`

**From subscriptionService.ts (db patterns):**
- Always `.eq('user_id', userId)` on every query (even with RLS) for belt-and-suspenders ownership check
- Return `data ?? []` with nullish coalescing fallback

**DB pattern for safe increment:**
The `addContribution` service does a fetch-then-update (not `current_amount + $1` raw SQL). This works because Supabase JS doesn't support atomic increments directly. Accept this limitation for Phase 2 solo users.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 11, Story 11.5 user story and ACs]
- [Source: _bmad-output/planning-artifacts/epics.md — FR13: Users can create savings goals with target amounts and deadlines]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013: Goal & Wishlist Model (goals table schema)]
- [Source: _bmad-output/planning-artifacts/architecture.md — File structure: `(dashboard)/goals/page.tsx`, `api/goals/`, `goalService.ts`, `useGoals.ts`, `GoalCard.tsx`, `GoalForm.tsx`, `GoalProgress.tsx`]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-024: idx_goals_household index (not needed in this solo story — no household_id yet)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Goals View: 3-col desktop, 2-col tablet, 1-col mobile grid]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Empty state: "Set your first savings goal" / "Create Goal" button]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Form validation: Amount > 0, deadline future, optional deadline]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Navigation: Goals sidebar item after Categories, always visible]
- [Source: supabase/migrations/012_detected_subscriptions.sql — Migration pattern: table + RLS + indexes + updated_at trigger]
- [Source: src/app/categories/page.tsx — Page pattern: 'use client' + AppLayout + useDisclosure + modal pattern]
- [Source: src/components/categories/CategoryModal.tsx — Form pattern: react-hook-form + zodResolver + useToast + pre-fill edit mode]
- [Source: src/lib/hooks/useAnnualizedProjections.ts — SWR hook pattern with KeyedMutator<T>]
- [Source: src/app/api/dashboard/annualized-projections/route.ts — API route pattern: dynamic + auth + error shape]
- [Source: src/components/layout/Sidebar.tsx — Nav item structure and icon import pattern]
- [Source: _bmad-output/implementation-artifacts/11-4-annualized-spending-projections.md — All code review lessons to apply]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation completed without errors.

### Completion Notes List

- All 10 tasks completed successfully
- Zod v4 compatibility: `invalid_type_error` replaced with `error` in number() schema definitions (Zod v4 breaking change)
- `createDeleteChainMock` in goalService.test.ts uses `mockReturnValueOnce(chain)` + `mockResolvedValueOnce(result)` to handle the two-chained `.eq()` calls in deleteGoal
- `handleCreateSuccess` in goals/page.tsx takes no arguments (Goal param dropped) — TypeScript allows narrower callback signatures
- BottomNav restructure deferred to a later story as documented in Dev Notes
- 1085 tests passing (up from 808 at Epic 10 completion), 0 TypeScript errors, 0 lint warnings
- **Code review fixes (2026-03-28)**: GoalForm stale values on re-open fixed (added `isOpen` to useEffect deps); deleteGoal test missing user_id ownership assertion added; unused `saved`/`target` i18n keys removed from en.json + bg.json; addContribution partial-failure cleanup gap documented with comment; GoalCard confirm button given `data-testid`; POST+PUT API routes validate name max-length 200; GoalProgress.test.tsx created (7 tests); useGoals response.json() explicit type cast added

### File List

**New files:**
- `supabase/migrations/013_goals.sql`
- `src/types/database.types.ts` (modified — Goal types section added)
- `src/lib/services/goalService.ts`
- `src/lib/services/__tests__/goalService.test.ts`
- `src/lib/hooks/useGoals.ts`
- `src/components/goals/GoalProgress.tsx`
- `src/components/goals/GoalCard.tsx`
- `src/components/goals/GoalForm.tsx`
- `src/components/goals/ContributionModal.tsx`
- `src/components/goals/__tests__/GoalCard.test.tsx`
- `src/components/goals/__tests__/GoalForm.test.tsx`
- `src/components/goals/__tests__/GoalProgress.test.tsx`
- `src/app/goals/page.tsx`
- `src/app/api/goals/route.ts`
- `src/app/api/goals/__tests__/goals.test.ts`
- `src/app/api/goals/[id]/route.ts`
- `src/app/api/goals/[id]/__tests__/goals-id.test.ts`
- `src/app/api/goals/[id]/contribute/route.ts`
- `src/app/api/goals/[id]/contribute/__tests__/contribute.test.ts`

**Modified files:**
- `src/components/layout/Sidebar.tsx` (Goals nav item + StarIcon)
- `messages/en.json` (navigation.goals + goals namespace)
- `messages/bg.json` (navigation.goals + goals namespace)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-28 | 1.0 | Initial implementation — all tasks complete | claude-sonnet-4-6 |
| 2026-03-28 | 1.1 | Code review fixes (HIGH+MEDIUM): GoalForm reset on open, deleteGoal user_id test, remove unused i18n keys, addContribution comment | claude-sonnet-4-6 |
| 2026-03-28 | 1.2 | Code review fixes (LOW): confirm-delete testid, API name max-length, GoalProgress tests, useGoals type cast | claude-sonnet-4-6 |
