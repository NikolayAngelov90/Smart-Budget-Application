# Component Library

**Last Updated:** 2025-12-09

Comprehensive catalog of reusable React components in the Smart Budget Application. Use these battle-tested components to maintain consistency and accelerate development.

## Table of Contents

1. [Layout Components](#layout-components)
   - [Sidebar](#sidebar)
   - [Header](#header)
   - [MobileNav](#mobilenav)
2. [Data Display Components](#data-display-components)
   - [CategoryBadge](#categorybadge)
   - [StatCard](#statcard)
   - [AIInsightCard](#aiinsightcard)
3. [Form Components](#form-components)
   - [CategoryMenu](#categorymenu)
   - [TransactionEntryModal](#transactionentrymodal)
   - [FAB (Floating Action Button)](#fab-floating-action-button)
4. [Dashboard Components](#dashboard-components)
   - [CategorySpendingChart](#categoryspendingchart)
   - [SpendingTrendsChart](#spendingtrendschart)
   - [MonthOverMonth](#monthovermonth)
   - [FilterBreadcrumbs](#filterbreadcrumbs)

---

## Layout Components

### Sidebar

**Location:** `src/components/layout/Sidebar.tsx`

**Purpose:** Main navigation sidebar with active link highlighting for desktop and tablet views.

**Props:** None (uses `usePathname` internally to detect active route)

**Features:**
- Trust Blue (#2b6cb0) active state with rounded corners
- 250px fixed width
- Collapsible on tablet (<1024px)
- Navigation items: Dashboard, Transactions, Categories, Insights
- Logout button at bottom

**Usage:**
```tsx
import { Sidebar } from '@/components/layout/Sidebar';

// Already included in AppLayout
<Sidebar />
```

**Visual:** Vertical sidebar with icon + text navigation items. Active item has blue background.

**Related:** Header, MobileNav, AppLayout

---

### Header

**Location:** `src/components/layout/Header.tsx`

**Purpose:** Top header bar with logo, user avatar, and logout button.

**Props:** None (uses Supabase auth context internally)

**Features:**
- Sticky positioning (stays at top on scroll)
- Responsive design (hides certain elements on mobile)
- User avatar with dropdown menu
- Logout functionality

**Usage:**
```tsx
import { Header } from '@/components/layout/Header';

// Already included in AppLayout
<Header />
```

**Visual:** Horizontal bar with "Smart Budget" logo on left, user avatar + logout on right.

**Related:** Sidebar, MobileNav, AppLayout

---

### MobileNav

**Location:** `src/components/layout/MobileNav.tsx`

**Purpose:** Mobile hamburger menu navigation using Chakra UI Drawer.

**Props:** None

**Features:**
- Only shown on mobile (<768px)
- Hamburger icon button in header
- Drawer slides in from left
- Same navigation items as Sidebar
- Overlay backdrop (clicks outside close drawer)

**Usage:**
```tsx
import { MobileNav } from '@/components/layout/MobileNav';

// Already included in AppLayout
<MobileNav />
```

**Visual:** Hamburger icon (☰) opens sliding drawer with navigation menu.

**Related:** Sidebar, Header, AppLayout

---

## Data Display Components

### CategoryBadge

**Location:** `src/components/categories/CategoryBadge.tsx`

**Purpose:** Display category name with color indicator in multiple visual styles.

**Props:**
```typescript
interface CategoryBadgeProps {
  category: {
    id: string;
    name: string;
    color: string;  // Hex format: #RRGGBB
    type: 'income' | 'expense';
  };
  variant?: 'dot' | 'badge' | 'border';  // Default: 'dot'
  size?: 'sm' | 'md' | 'lg';             // Default: 'md'
  showType?: boolean;                     // Show "(income)" or "(expense)"
}
```

**Variants:**
- **dot:** Color circle (8-16px) + category name (horizontal layout)
- **badge:** Colored background badge with contrast-adjusted text
- **border:** Left border accent (3-5px) with category name

**Features:**
- WCAG AA compliant contrast (automatic text color selection)
- Minimum 8px color indicators for mobile accessibility
- Border added to light colors for visibility
- TypeScript strict mode compatible

**Usage:**
```tsx
import { CategoryBadge } from '@/components/categories/CategoryBadge';

// Dot variant (most common)
<CategoryBadge
  category={{ id: '1', name: 'Dining', color: '#FF6B35', type: 'expense' }}
  variant="dot"
/>

// Badge variant (for emphasis)
<CategoryBadge
  category={{ id: '2', name: 'Salary', color: '#4ECDC4', type: 'income' }}
  variant="badge"
  size="lg"
/>

// Border variant (for lists)
<CategoryBadge
  category={{ id: '3', name: 'Groceries', color: '#FFE66D', type: 'expense' }}
  variant="border"
  showType
/>
```

**Visual Examples:**
- Dot: `[●] Dining` (orange circle + text)
- Badge: `Dining` (orange background, white text)
- Border: `║ Dining (expense)` (orange left border)

**Related:** CategoryMenu (uses badge internally), TransactionList

---

### StatCard

**Location:** `src/components/dashboard/StatCard.tsx`

**Purpose:** Display financial metrics with optional trend indicators and loading states.

**Props:**
```typescript
interface StatCardProps {
  label: string;                      // Metric name (e.g., "Total Balance")
  value: string;                      // Formatted value (e.g., "$1,234.56")
  trend?: number;                     // Percentage change (e.g., 5.2 or -3.1)
  trendLabel?: string;                // Trend description (e.g., "vs last month")
  colorScheme?: string;               // Chakra color (green, red, blue)
  icon?: ReactNode;                   // Optional icon
  isLoading?: boolean;                // Show skeleton
}
```

**Features:**
- Skeleton loading state (smooth UX during data fetch)
- Trend arrow (↑ for positive, ↓ for negative)
- Responsive font sizes (smaller on mobile)
- Color-coded by scheme (green for positive, red for negative)
- Card styling with shadow and border

**Usage:**
```tsx
import { StatCard } from '@/components/dashboard/StatCard';
import { formatCurrency } from '@/lib/utils/currency';

<StatCard
  label="Total Balance"
  value={formatCurrency(1500)}
  trend={5.2}
  trendLabel="vs last month"
  colorScheme="green"
  isLoading={false}
/>
```

**Visual:** White card with large value (e.g., "$1,500"), small label above, small trend below with arrow.

**Related:** DashboardStats (container), Dashboard page

---

### AIInsightCard

**Location:** `src/components/insights/AIInsightCard.tsx`

**Purpose:** Display AI-generated financial insight with priority badge and action buttons.

**Props:**
```typescript
interface AIInsightCardProps {
  insight: {
    id: string;
    title: string;
    description: string;
    type: 'spending_increase' | 'budget_recommendation' | 'unusual_expense' | 'positive_reinforcement';
    priority: number;           // 1-10 (1=low, 10=critical)
    is_dismissed: boolean;
    created_at: string;
    metadata?: Json;
  };
  onDismiss?: (id: string) => void;
  onClick?: (id: string) => void;
}
```

**Features:**
- Priority badge (High/Medium/Low based on score)
- Dismiss button (X icon, calls onDismiss callback)
- Clickable card (navigates to detail view)
- Icon based on type (⚠️ spending, 💡 recommendation, ✨ positive)
- Responsive layout (stacks on mobile)

**Usage:**
```tsx
import { AIInsightCard } from '@/components/insights/AIInsightCard';

<AIInsightCard
  insight={insight}
  onDismiss={(id) => handleDismiss(id)}
  onClick={(id) => router.push(`/insights/${id}`)}
/>
```

**Visual:** Card with colored left border (red=high, yellow=med, blue=low), title, description, priority badge top-right, dismiss X button.

**Related:** AIBudgetCoach, Insights page

---

## Form Components

### CategoryMenu

**Location:** `src/components/categories/CategoryMenu.tsx`

**Purpose:** Dropdown menu for category selection with recent categories section and keyboard navigation.

**Props:**
```typescript
interface CategoryMenuProps {
  value?: string;                     // Selected category ID
  onChange: (categoryId: string) => void;
  recentCategories?: Category[];      // Last 5 used categories
  allCategories: Category[];          // Full category list
}
```

**Features:**
- Two-section menu: Recent (top) + All Categories (bottom)
- Color-coded dots for visual identification
- Keyboard navigation (Arrow keys, Enter, Escape)
- 44px minimum touch targets (mobile accessibility)
- Search/filter (typing narrows list)

**Usage:**
```tsx
import { CategoryMenu } from '@/components/categories/CategoryMenu';

const [selectedCategory, setSelectedCategory] = useState<string>('');

<CategoryMenu
  value={selectedCategory}
  onChange={setSelectedCategory}
  recentCategories={recentCategories}
  allCategories={allCategories}
/>
```

**Visual:** Dropdown button showing selected category (or "Select Category"), opens menu with "Recent" header + recent items, divider, "All Categories" header + full list.

**Related:** TransactionEntryModal (uses this for category selection), CategoryBadge

---

### TransactionEntryModal

**Location:** `src/components/transactions/TransactionEntryModal.tsx`

**Purpose:** Modal for creating or editing transactions with validation and optimistic UI.

**Props:**
```typescript
interface TransactionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;      // For editing (if provided, modal is in edit mode)
  onSuccess?: () => void;          // Callback after successful create/update
}
```

**Features:**
- React Hook Form + Zod validation
- Optimistic UI (immediate feedback, rollback on error)
- CategoryMenu integration (autocomplete category selection)
- Date picker (date-fns)
- Amount input (formatted currency)
- Notes textarea (optional)
- Type toggle (income/expense with color coding)
- Form state persistence during errors

**Usage:**
```tsx
import { TransactionEntryModal } from '@/components/transactions/TransactionEntryModal';

const { isOpen, onOpen, onClose } = useDisclosure();

<>
  <Button onClick={onOpen}>Add Transaction</Button>
  <TransactionEntryModal
    isOpen={isOpen}
    onClose={onClose}
    onSuccess={() => {
      mutate(); // Refresh transaction list
      toast({ title: 'Transaction created!' });
    }}
  />
</>

// Edit mode
<TransactionEntryModal
  isOpen={isEditOpen}
  onClose={onEditClose}
  transaction={transactionToEdit}
  onSuccess={() => mutate()}
/>
```

**Visual:** Centered modal overlay with form fields: Type toggle (Income/Expense), Amount ($), Category dropdown, Date picker, Notes (optional). Cancel + Submit buttons at bottom.

**Related:** FAB (triggers modal), TransactionsList (edit trigger), CategoryMenu

---

### FAB (Floating Action Button)

**Location:** `src/components/common/FloatingActionButton.tsx`

**Purpose:** Fixed-position button for primary actions (typically opens transaction entry modal).

**Props:**
```typescript
interface FABProps {
  onClick: () => void;
  icon?: ReactNode;              // Default: <AddIcon />
  label?: string;                 // Aria-label for accessibility
  colorScheme?: string;           // Default: 'blue' (Trust Blue)
}
```

**Features:**
- Fixed positioning (bottom-right corner)
- Mobile-friendly (60px diameter, easy thumb reach)
- Elevation shadow (floats above content)
- Hover/active states
- Icon + optional label
- Accessible (aria-label, role="button")

**Usage:**
```tsx
import { FAB } from '@/components/common/FloatingActionButton';
import { AddIcon } from '@chakra-ui/icons';

const { isOpen, onOpen, onClose } = useDisclosure();

<>
  <FAB
    onClick={onOpen}
    icon={<AddIcon />}
    label="Add Transaction"
    colorScheme="blue"
  />
  <TransactionEntryModal isOpen={isOpen} onClose={onClose} />
</>
```

**Visual:** Round blue button with + icon, fixed at bottom-right (24px from edges).

**Related:** TransactionEntryModal (commonly triggers this), Dashboard, Transactions page

---

## Dashboard Components

### CategorySpendingChart

**Location:** `src/components/dashboard/CategorySpendingChart.tsx`

**Purpose:** Pie/donut chart showing expense breakdown by category with drill-down capability.

**Props:**
```typescript
interface CategorySpendingChartProps {
  month?: string;                    // YYYY-MM format (default: current month)
  chartType?: 'pie' | 'donut';       // Default: 'donut'
  height?: number;                    // Default: 300
}
```

**Features:**
- Recharts pie chart with category colors
- Drill-down: Click slice → navigate to transactions filtered by category + month
- Custom tooltip (shows amount + percentage)
- Legend with category names
- Real-time updates (Realtime subscription via centralized manager)
- Loading skeleton
- Empty state ("No expenses this month")
- Accessible data table (visually hidden for screen readers)

**Usage:**
```tsx
import { CategorySpendingChart } from '@/components/dashboard/CategorySpendingChart';

// Default (current month, donut chart)
<CategorySpendingChart />

// Custom month and chart type
<CategorySpendingChart month="2024-11" chartType="pie" height={400} />
```

**Visual:** Donut chart with colored slices representing categories. Legend below shows category names. Hover shows amount + percentage. Click navigates to filtered transactions.

**Related:** SpendingTrendsChart, MonthOverMonth, FilterBreadcrumbs (drill-down target)

---

### SpendingTrendsChart

**Location:** `src/components/dashboard/SpendingTrendsChart.tsx`

**Purpose:** Line chart showing income vs expenses trends over last N months with drill-down.

**Props:**
```typescript
interface SpendingTrendsChartProps {
  months?: number;                    // Number of months to display (default: 6)
  height?: number;                    // Chart height in pixels (default: 300)
}
```

**Features:**
- Recharts line chart (dual lines: income green, expenses red)
- Drill-down: Click data point → navigate to transactions filtered by month
- Grid lines, axis labels, legend
- Responsive (shows 3 months on mobile, 6 on desktop)
- Real-time updates (Realtime subscription)
- Loading skeleton
- Empty state ("Add transactions to see trends")
- Accessible data table (visually hidden)

**Usage:**
```tsx
import { SpendingTrendsChart } from '@/components/dashboard/SpendingTrendsChart';

// Default (6 months)
<SpendingTrendsChart />

// Custom months
<SpendingTrendsChart months={12} height={400} />
```

**Visual:** Line chart with two lines (green income, red expenses). X-axis shows month labels (Jan, Feb, Mar). Y-axis shows currency amounts. Click data point to drill down.

**Related:** CategorySpendingChart, MonthOverMonth, FilterBreadcrumbs

---

### MonthOverMonth

**Location:** `src/components/dashboard/MonthOverMonth.tsx`

**Purpose:** Highlight cards showing significant spending changes (>20%) between current and previous month.

**Props:**
```typescript
interface MonthOverMonthProps {
  month?: string;                    // Optional month in YYYY-MM format (default: current)
}
```

**Features:**
- Displays only significant changes (>20% threshold)
- Up/down arrows (↑ increase, ↓ decrease)
- Color-coded (red for increases, green for decreases)
- Click to drill-down to filtered transactions
- Badge with percentage change
- Real-time updates (Realtime subscription)
- Loading skeleton
- Empty state ("No significant changes this month")

**Usage:**
```tsx
import { MonthOverMonth } from '@/components/dashboard/MonthOverMonth';

// Default (current month vs previous)
<MonthOverMonth />

// Custom month
<MonthOverMonth month="2024-11" />
```

**Visual:** List of cards, each showing: Category name, up/down arrow, percentage badge, amount comparison ("$500 vs $400"). Click navigates to filtered transactions.

**Related:** CategorySpendingChart, SpendingTrendsChart, FilterBreadcrumbs

---

### FilterBreadcrumbs

**Location:** `src/components/transactions/FilterBreadcrumbs.tsx`

**Purpose:** Display active drill-down filters (category and/or month) with clear button on transactions page.

**Props:** None (reads from URL query parameters)

**Features:**
- Only renders when filters are active (returns null otherwise)
- Displays category name with colored badge (fetched from categories API)
- Displays formatted month ("November 2024" from "2024-11")
- Clear button (X icon) removes all filters and navigates to /transactions
- Responsive layout (wraps on mobile)

**Usage:**
```tsx
import { FilterBreadcrumbs } from '@/components/transactions/FilterBreadcrumbs';

// Add to transactions page (reads URL automatically)
// URL: /transactions?category=abc123&month=2024-11
<FilterBreadcrumbs />
// Renders: "Filtering: [Dining] November 2024 [X]"
```

**Visual:** Gray background box with "Filtering:" label, category badge, month text, X button on right. Only shows when URL has ?category or ?month params.

**Related:** CategorySpendingChart (drill-down source), SpendingTrendsChart, MonthOverMonth, Transactions page

---

## Best Practices

### Component Reuse
- Always check this library before creating new components
- Extend existing components via props rather than duplicating code
- Follow established patterns (color schemes, sizing, spacing)

### Accessibility
- All components follow WCAG 2.1 Level A standards minimum
- Use semantic HTML (buttons, headings, labels)
- Minimum 44px touch targets for mobile
- Keyboard navigation support
- Screen reader friendly (aria-labels, hidden data tables for charts)

### Performance
- Components use React.memo where appropriate
- Skeleton loading states prevent layout shift
- Optimistic UI for forms (immediate feedback)
- Real-time updates via centralized subscription manager (Story 7.3)

### TypeScript
- All components have strict type definitions
- Props interfaces exported for reuse
- No `any` types (use `unknown` + type guards if needed)

---

**Need help?** Check the component source code or ask in team chat.
