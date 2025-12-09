# API Naming Conventions

**Last Updated:** 2025-12-09

Standardized API routing, naming patterns, request/response formats, and authentication requirements for the Smart Budget Application REST API.

## Table of Contents

1. [Naming Pattern](#naming-pattern)
2. [API Routes by Domain](#api-routes-by-domain)
   - [Auth Domain](#auth-domain)
   - [Transactions Domain](#transactions-domain)
   - [Categories Domain](#categories-domain)
   - [Dashboard Domain](#dashboard-domain)
   - [Insights Domain](#insights-domain)
   - [Cron Domain](#cron-domain-internal)
3. [Request/Response Format Standards](#requestresponse-format-standards)
4. [Query Parameter Conventions](#query-parameter-conventions)
5. [Status Code Guidelines](#status-code-guidelines)
6. [Authentication Requirements](#authentication-requirements)
7. [Error Handling](#error-handling)

---

## Naming Pattern

All API routes follow a consistent pattern for predictability and maintainability:

```
/api/[domain]/[resource]-[action]
```

### Pattern Components

- **domain:** High-level feature area
  - Examples: `auth`, `transactions`, `categories`, `dashboard`, `insights`
  - Groups related endpoints together
  - Maps to business domains

- **resource:** Entity or aggregation being operated on
  - Examples: `stats`, `spending-by-category`, `trends`, `month-over-month`
  - Singular for single items (`/transactions/[id]`)
  - Plural for collections (`/transactions`)

- **action:** Specific operation (optional)
  - Examples: `dismiss`, `undismiss`, `track`, `generate`
  - Used for non-CRUD operations
  - Always follows resource (e.g., `/insights/[id]/dismiss`)

### Pattern Examples

```
✅ Good Examples:
/api/dashboard/stats                     # Get dashboard statistics
/api/dashboard/spending-by-category      # Get category spending aggregation
/api/insights/[id]/dismiss               # Dismiss a specific insight

❌ Bad Examples (avoid):
/api/getDashboardStats                   # Verb in route (use HTTP method instead)
/api/dashboard/spendingByCategory        # camelCase (use kebab-case)
/api/insight/123/dismiss                 # Singular domain (use plural)
```

---

## API Routes by Domain

### Auth Domain

Authentication and onboarding routes.

#### POST `/api/auth/onboarding`

**Purpose:** Seed default categories and run onboarding tasks for new users.

**Request:**
```json
{
  "userId": "uuid-string"
}
```

**Response (201):**
```json
{
  "data": {
    "categoriesCreated": 11,
    "onboardingComplete": true
  },
  "message": "Onboarding completed successfully"
}
```

**Auth:** None (called from auth callback during user creation)

**Notes:** Idempotent (safe to call multiple times, only seeds once)

---

### Transactions Domain

CRUD operations for financial transactions.

#### GET `/api/transactions`

**Purpose:** List user's transactions with optional filtering.

**Query Parameters:**
- `category` (optional): Filter by category ID
- `startDate` (optional): ISO 8601 date (YYYY-MM-DD)
- `endDate` (optional): ISO 8601 date (YYYY-MM-DD)
- `type` (optional): `income` | `expense`
- `page` (optional): Page number (1-indexed, default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "amount": 42.50,
      "type": "expense",
      "category_id": "uuid",
      "date": "2024-11-15",
      "notes": "Lunch at cafe",
      "created_at": "2024-11-15T12:34:56Z",
      "category": {
        "id": "uuid",
        "name": "Dining",
        "color": "#FF6B35",
        "type": "expense"
      }
    }
  ],
  "count": 42,
  "limit": 50,
  "offset": 0
}
```

**Auth:** Required

---

#### POST `/api/transactions`

**Purpose:** Create a new transaction.

**Request:**
```json
{
  "amount": 42.50,
  "type": "expense",
  "category_id": "uuid",
  "date": "2024-11-15",
  "notes": "Optional description"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "amount": 42.50,
    "type": "expense",
    "category_id": "uuid",
    "date": "2024-11-15",
    "notes": "Optional description",
    "created_at": "2024-11-15T12:34:56Z"
  },
  "message": "Transaction created successfully"
}
```

**Auth:** Required

**Validation:**
- `amount`: Required, positive number
- `type`: Required, must be "income" or "expense"
- `category_id`: Required, must exist and belong to user
- `date`: Required, ISO 8601 date format
- `notes`: Optional, max 500 characters

---

#### GET `/api/transactions/[id]`

**Purpose:** Get a single transaction by ID.

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "amount": 42.50,
    "type": "expense",
    "category_id": "uuid",
    "date": "2024-11-15",
    "notes": "Lunch at cafe",
    "created_at": "2024-11-15T12:34:56Z",
    "category": {
      "id": "uuid",
      "name": "Dining",
      "color": "#FF6B35",
      "type": "expense"
    }
  }
}
```

**Auth:** Required (must own transaction)

**Errors:**
- 404 if transaction doesn't exist or doesn't belong to user

---

#### PUT `/api/transactions/[id]`

**Purpose:** Update an existing transaction.

**Request:** (all fields optional, only include fields to update)
```json
{
  "amount": 45.00,
  "category_id": "new-uuid",
  "notes": "Updated description"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "amount": 45.00,
    "type": "expense",
    "category_id": "new-uuid",
    "date": "2024-11-15",
    "notes": "Updated description",
    "created_at": "2024-11-15T12:34:56Z"
  },
  "message": "Transaction updated successfully"
}
```

**Auth:** Required (must own transaction)

**Errors:**
- 404 if transaction doesn't exist or doesn't belong to user
- 400 if validation fails

---

#### DELETE `/api/transactions/[id]`

**Purpose:** Delete a transaction.

**Response (204):** Empty body

**Auth:** Required (must own transaction)

**Errors:**
- 404 if transaction doesn't exist or doesn't belong to user

---

### Categories Domain

CRUD operations for expense/income categories.

#### GET `/api/categories`

**Purpose:** List user's categories (default + custom).

**Query Parameters:**
- `recent` (optional): If "true", return only recently used categories (last 5)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Dining",
      "color": "#FF6B35",
      "type": "expense",
      "is_custom": false,
      "created_at": "2024-11-01T10:00:00Z"
    }
  ],
  "count": 15
}
```

**Auth:** Required

---

#### POST `/api/categories`

**Purpose:** Create a custom category.

**Request:**
```json
{
  "name": "Pet Supplies",
  "color": "#9B59B6",
  "type": "expense"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Pet Supplies",
    "color": "#9B59B6",
    "type": "expense",
    "is_custom": true,
    "created_at": "2024-11-15T12:34:56Z"
  },
  "message": "Category created successfully"
}
```

**Auth:** Required

**Validation:**
- `name`: Required, unique per user, max 50 characters
- `color`: Required, hex format (#RRGGBB)
- `type`: Required, "income" or "expense"

**Errors:**
- 409 if category name already exists for user

---

#### PUT `/api/categories/[id]`

**Purpose:** Update a custom category.

**Request:** (all fields optional)
```json
{
  "name": "Pet Care",
  "color": "#8E44AD"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Pet Care",
    "color": "#8E44AD",
    "type": "expense",
    "is_custom": true,
    "updated_at": "2024-11-15T12:34:56Z"
  },
  "message": "Category updated successfully"
}
```

**Auth:** Required (must own category)

**Errors:**
- 403 if trying to edit predefined category (is_custom = false)
- 404 if category doesn't exist
- 409 if new name conflicts with existing category

---

#### DELETE `/api/categories/[id]`

**Purpose:** Delete a custom category (orphans associated transactions).

**Response (204):** Empty body

**Auth:** Required (must own category)

**Errors:**
- 403 if trying to delete predefined category
- 404 if category doesn't exist

**Notes:** Transactions using this category will have `category_id` set to null (orphaned).

---

### Dashboard Domain

Aggregated statistics and visualizations for dashboard.

#### GET `/api/dashboard/stats`

**Purpose:** Get dashboard summary statistics (balance, income, expenses, trends).

**Response (200):**
```json
{
  "data": {
    "balance": 2500.00,
    "income": {
      "current": 3000.00,
      "previous": 2800.00,
      "trend": 7.14
    },
    "expenses": {
      "current": 500.00,
      "previous": 600.00,
      "trend": -16.67
    }
  }
}
```

**Auth:** Required

---

#### GET `/api/dashboard/spending-by-category`

**Purpose:** Get expense breakdown by category for pie chart.

**Query Parameters:**
- `month` (optional): YYYY-MM format (default: current month)

**Response (200):**
```json
{
  "data": {
    "month": "2024-11",
    "total": 500.00,
    "categories": [
      {
        "category_id": "uuid",
        "category_name": "Dining",
        "category_color": "#FF6B35",
        "amount": 200.00,
        "percentage": 40.0,
        "transaction_count": 12
      }
    ]
  }
}
```

**Auth:** Required

---

#### GET `/api/dashboard/trends`

**Purpose:** Get income vs expenses trends over last N months for line chart.

**Query Parameters:**
- `months` (optional): Number of months (default: 6, max: 12)

**Response (200):**
```json
{
  "data": {
    "months": [
      {
        "month": "2024-06",
        "monthLabel": "Jun",
        "income": 3000.00,
        "expenses": 2200.00,
        "net": 800.00
      }
    ],
    "startDate": "2024-06-01",
    "endDate": "2024-11-30"
  }
}
```

**Auth:** Required

---

#### GET `/api/dashboard/month-over-month`

**Purpose:** Get significant spending changes (>20%) for current vs previous month.

**Query Parameters:**
- `month` (optional): YYYY-MM format (default: current month)

**Response (200):**
```json
{
  "data": {
    "changes": [
      {
        "categoryId": "uuid",
        "categoryName": "Dining",
        "categoryColor": "#FF6B35",
        "currentAmount": 300.00,
        "previousAmount": 200.00,
        "percentChange": 50.0,
        "absoluteChange": 100.00,
        "direction": "increase"
      }
    ],
    "currentMonth": "2024-11",
    "previousMonth": "2024-10"
  }
}
```

**Auth:** Required

**Notes:** Only includes categories with >20% change.

---

### Insights Domain

AI-generated financial insights and user interactions.

#### GET `/api/insights`

**Purpose:** List AI insights with filtering and pagination.

**Query Parameters:**
- `dismissed` (optional): "true" | "false" (filter by dismissed status)
- `priority` (optional): Filter by priority (1-10)
- `type` (optional): Filter by insight type
- `page` (optional): Page number (1-indexed)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Dining spending increased 35%",
      "description": "You spent $270 on Dining this month, up 35% from last month ($200). Consider setting a budget.",
      "type": "spending_increase",
      "priority": 7,
      "is_dismissed": false,
      "metadata": {
        "category_id": "uuid",
        "category_name": "Dining",
        "percent_change": 35.0
      },
      "created_at": "2024-11-15T08:00:00Z",
      "view_count": 3,
      "first_viewed_at": "2024-11-15T09:00:00Z"
    }
  ],
  "count": 15,
  "page": 1,
  "limit": 20
}
```

**Auth:** Required

---

#### POST `/api/insights/generate`

**Purpose:** Manually trigger insight generation (also runs via cron).

**Response (201):**
```json
{
  "data": {
    "insightsGenerated": 5,
    "timestamp": "2024-11-15T12:34:56Z"
  },
  "message": "Insights generated successfully"
}
```

**Auth:** Required

---

#### POST `/api/insights/[id]/dismiss`

**Purpose:** Dismiss an insight (hide from dashboard).

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "is_dismissed": true,
    "dismissed_at": "2024-11-15T12:34:56Z"
  },
  "message": "Insight dismissed"
}
```

**Auth:** Required (must own insight)

---

#### POST `/api/insights/[id]/undismiss`

**Purpose:** Undismiss an insight (restore to dashboard).

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "is_dismissed": false,
    "dismissed_at": null
  },
  "message": "Insight restored"
}
```

**Auth:** Required (must own insight)

---

#### POST `/api/insights/[id]/track`

**Purpose:** Track user interaction with insight (click, view, expand).

**Request:**
```json
{
  "action": "view" | "click" | "expand"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "view_count": 4,
    "last_viewed_at": "2024-11-15T12:34:56Z"
  }
}
```

**Auth:** Required (must own insight)

---

#### GET `/api/insights/analytics`

**Purpose:** Get insight analytics (effectiveness metrics for admin/future epic).

**Response (200):**
```json
{
  "data": {
    "totalInsights": 100,
    "dismissedRate": 0.25,
    "avgViewsPerInsight": 3.5,
    "topInsightTypes": [
      { "type": "spending_increase", "count": 45 }
    ]
  }
}
```

**Auth:** Required

**Notes:** Not currently exposed in UI (reserved for future admin dashboard).

---

### Cron Domain (Internal)

Scheduled background jobs (Vercel Cron).

#### POST `/api/cron/generate-insights`

**Purpose:** Scheduled daily insight generation (triggered by Vercel Cron).

**Headers Required:**
```
Authorization: Bearer [CRON_SECRET]
```

**Response (200):**
```json
{
  "data": {
    "usersProcessed": 42,
    "insightsGenerated": 156,
    "timestamp": "2024-11-15T02:00:00Z"
  },
  "message": "Cron job completed"
}
```

**Auth:** Vercel Cron secret (not user auth)

**Notes:** Runs daily at 2 AM UTC. See [`.github/workflows/cron.yml`](../.github/workflows/cron.yml).

---

## Request/Response Format Standards

### Success Responses

**200 OK** (GET, PUT requests)
```json
{
  "data": { /* ... resource data ... */ },
  "message": "Optional success message"
}
```

**201 Created** (POST creating resource)
```json
{
  "data": { /* ... created resource ... */ },
  "message": "Resource created successfully"
}
```

**204 No Content** (DELETE requests)
- Empty body (no JSON)
- Indicates successful deletion

### Error Responses

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "details": {
    /* Optional additional context */
  }
}
```

See [Status Code Guidelines](#status-code-guidelines) for specific error codes.

---

## Query Parameter Conventions

### Filtering

Use resource name as parameter:
```
?category=uuid           # Filter by category
?month=2024-11           # Filter by month (YYYY-MM)
?type=expense            # Filter by type
```

### Pagination

1-indexed pages (page 1 is first page):
```
?page=1&limit=20         # First 20 items
?page=2&limit=20         # Next 20 items (items 21-40)
```

Default: `page=1`, `limit=50`
Max limit: 100

### Date Ranges

ISO 8601 format:
```
?startDate=2024-11-01&endDate=2024-11-30
```

### Sorting (Not Yet Implemented)

Reserved for future:
```
?sort=date&order=desc    # Sort by date descending
?sort=amount&order=asc   # Sort by amount ascending
```

### Searching (Not Yet Implemented)

Reserved for future:
```
?q=coffee                # Search transactions for "coffee"
```

---

## Status Code Guidelines

### Success Codes

- **200 OK:** Request succeeded, returning data
  - GET requests (retrieve resource)
  - PUT requests (update resource)
  - POST actions (dismiss, track, undismiss)

- **201 Created:** Resource successfully created
  - POST requests creating new resources
  - Returns created resource with ID

- **204 No Content:** Request succeeded, no body returned
  - DELETE requests (successful deletion)

### Client Error Codes

- **400 Bad Request:** Validation failed
  ```json
  {
    "error": "Validation error",
    "details": {
      "amount": "Amount must be a positive number",
      "category_id": "Category does not exist"
    }
  }
  ```

- **401 Unauthorized:** Missing or invalid authentication
  ```json
  { "error": "Unauthorized" }
  ```

- **403 Forbidden:** Authenticated but not allowed
  ```json
  { "error": "Cannot delete predefined categories" }
  ```

- **404 Not Found:** Resource doesn't exist
  ```json
  { "error": "Transaction not found" }
  ```

- **409 Conflict:** Resource conflict (duplicate)
  ```json
  { "error": "Category name already exists" }
  ```

### Server Error Codes

- **500 Internal Server Error:** Unexpected error
  ```json
  {
    "error": "Internal server error",
    "details": "Contact support if this persists"
  }
  ```

**Note:** Never expose stack traces or sensitive error details in production.

---

## Authentication Requirements

### Protected Routes

**All API routes require authentication** except:
- `/api/auth/*` (authentication itself)

### Auth Implementation

Routes check authentication using:
```typescript
import { getUser } from '@/lib/auth/server';

const user = await getUser();
if (!user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
```

### Auth Flow

1. User authenticates via Supabase (email/password or OAuth)
2. Supabase sets auth cookies
3. Server reads cookies via `getUser()`
4. User ID passed to business logic for authorization

### Authorization

- Resources (transactions, categories, insights) are **user-scoped**
- Database queries filter by `user_id`
- Row Level Security (RLS) in Supabase enforces access control
- Attempting to access another user's resource returns 404 (not 403, to avoid information disclosure)

---

## Error Handling

### Client-Side Error Handling

```typescript
try {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const { data } = await response.json();
  return data;
} catch (error) {
  console.error('Failed to create transaction:', error);
  toast({
    title: 'Error',
    description: error.message,
    status: 'error'
  });
}
```

### Server-Side Error Handling

```typescript
export async function POST(request: Request) {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request
    const body = await request.json();

    // Validate
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Business logic
    const transaction = await createTransaction(user.id, body);

    return NextResponse.json(
      { data: transaction, message: 'Transaction created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Transaction creation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Best Practices

### API Design

1. **Be Consistent:** Follow the naming pattern religiously
2. **Use Proper HTTP Methods:** GET (read), POST (create), PUT (update), DELETE (delete)
3. **Version Your API:** Add `/v1` prefix if breaking changes needed (future)
4. **Return Meaningful Errors:** Clients need context to fix issues
5. **Validate Early:** Check auth and validation before expensive operations

### Performance

1. **Pagination:** Always paginate list endpoints (default limit: 50)
2. **Caching:** Consider SWR/React Query client-side caching
3. **Database Indexes:** Ensure queries are indexed (user_id, created_at, etc.)
4. **Rate Limiting:** Implement rate limiting for public endpoints (Upstash Redis)

### Security

1. **Never Trust Client Input:** Always validate and sanitize
2. **Use Parameterized Queries:** Prevent SQL injection (Supabase handles this)
3. **RLS Enabled:** Supabase Row Level Security enforces access control
4. **No Secrets in Responses:** Never return passwords, API keys, etc.
5. **CORS Configured:** Only allow requests from your domain

---

**Questions?** Check [architecture documentation](architecture.md) or ask in team chat.
