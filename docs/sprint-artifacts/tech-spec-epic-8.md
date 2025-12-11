# Epic Technical Specification: Data Export & Settings

Date: 2025-12-11
Author: Niki
Epic ID: 8
Status: Draft

---

## Overview

This epic implements data portability and user account management features, fulfilling the PRD's core promise of data ownership (FR38-FR43, FR47). Users can export their complete financial history to CSV for external analysis or PDF reports for record-keeping, manage account settings and preferences, view multi-device sync status, and access previously loaded data offline. These features complete the data ownership story by giving users full control over their financial data while maintaining the cloud-native benefits of automatic synchronization across devices.

## Objectives and Scope

**In Scope:**
- ✅ CSV export of complete transaction history (client-side, no server processing)
- ✅ PDF financial report generation for selected month (client-side with jsPDF)
- ✅ Settings page with account information, data export, privacy info, and preferences
- ✅ Multi-device sync status indicator and session management
- ✅ Offline data caching for read-only viewing (Phase 1 - viewing only, not editing)
- ✅ Account deletion with data export and confirmation
- ✅ Display name and profile picture management
- ✅ Currency and date format preferences

**Out of Scope:**
- ❌ Offline transaction editing/creation (deferred to Phase 2)
- ❌ Automatic scheduled exports or email delivery
- ❌ Import from CSV/PDF (separate future epic)
- ❌ Data encryption at rest beyond Supabase defaults
- ❌ GDPR compliance automation (manual process acceptable for MVP)
- ❌ Multi-currency support (USD only in MVP)
- ❌ Advanced PDF customization (charts, branding beyond basic)

## System Architecture Alignment

This epic aligns with the established Next.js + Supabase + Chakra UI architecture:

**Client-Side Export Libraries:**
- **papaparse** for CSV generation (FR39) - client-side processing ensures privacy
- **jsPDF + jspdf-autotable** for PDF reports (FR40) - no server-side rendering needed

**Supabase Integration:**
- Uses existing `transactionService` and `categoryService` to fetch data
- Leverages Supabase Auth sessions for multi-device tracking (FR43)
- Supabase Realtime connection state for sync status indicators (FR42)

**API Routes (Next.js App Router):**
- `GET /api/transactions?all=true` - fetch all transactions for export
- `PUT /api/user/profile` - update display name and preferences
- `DELETE /api/user/account` - account deletion endpoint

**PWA and Offline (FR47):**
- **next-pwa** plugin for service worker configuration
- **SWR cache** with localStorage persistence for offline data viewing
- `manifest.json` for PWA installability

**Components:**
- `/app/(dashboard)/settings/page.tsx` - new settings page route
- Chakra UI Form components (Input, Button, Select, Alert) for consistent UX

## Detailed Design

### Services and Modules

| Service/Module | Responsibility | Inputs | Outputs | Owner |
|----------------|----------------|---------|---------|-------|
| **exportService.ts** | Client-side CSV/PDF generation | Transaction data, user preferences | CSV/PDF files via browser download | Story 8.1, 8.2 |
| **settingsService.ts** | User preferences and profile management | User profile updates, preference changes | Updated user metadata | Story 8.3 |
| **offlineService.ts** | Service Worker and cache management | SWR cache state, online/offline events | Cached data, sync status | Story 8.5 |
| **sessionService.ts** | Multi-device session tracking | Supabase Auth sessions | Device list, active sessions | Story 8.4 |
| **Settings Page Component** | `/app/(dashboard)/settings/page.tsx` | User data, preferences | Settings UI with form controls | Story 8.3 |
| **CSV Export Function** | `exportToCSV()` in exportService | All user transactions | CSV file blob | Story 8.1 |
| **PDF Export Function** | `exportToPDF()` in exportService | Monthly transaction summary, stats | PDF file blob | Story 8.2 |
| **Offline Status Hook** | `useOnlineStatus()` custom hook | Navigator online API, Supabase connection | Boolean online state, last sync time | Story 8.5 |

### Data Models and Contracts

**User Profile Extension (new table or metadata field):**
```typescript
// types/user.types.ts
export interface UserProfile {
  id: string; // auth.users.id
  display_name: string | null;
  profile_picture_url: string | null;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  currency_format: 'USD' | 'EUR' | 'GBP'; // MVP: USD only
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  onboarding_completed: boolean;
}
```

**CSV Export Structure:**
```typescript
// CSV columns (as defined in Story 8.1 AC)
interface CSVRow {
  Date: string; // YYYY-MM-DD (ISO 8601)
  Type: 'income' | 'expense';
  Category: string; // Category name
  Amount: string; // "$123.45" format
  Notes: string; // Empty string if null
  'Created At': string; // YYYY-MM-DD HH:MM:SS
}
```

**PDF Report Data:**
```typescript
// types/export.types.ts
export interface PDFReportData {
  month: string; // 'YYYY-MM'
  summary: {
    total_income: number;
    total_expenses: number;
    net_balance: number;
  };
  categories: {
    name: string;
    amount: number;
    percentage: number;
  }[];
  top_transactions: Transaction[]; // Top 5 highest expenses
  chart_images?: {
    pie_chart?: string; // Base64 PNG (optional)
    trend_chart?: string; // Base64 PNG (optional)
  };
}
```

**Session/Device Tracking:**
```typescript
// types/session.types.ts
export interface DeviceSession {
  session_id: string;
  device_name: string; // "Chrome on Windows"
  last_active: string; // ISO timestamp
  is_current: boolean;
  ip_address?: string; // Optional, from Supabase Auth
}
```

**Offline Cache State:**
```typescript
// types/offline.types.ts
export interface OfflineState {
  is_online: boolean;
  last_sync: string | null; // ISO timestamp
  cached_data_timestamp: string | null;
  has_pending_changes: boolean; // Phase 2
}
```

**Database Schema Changes:**
```sql
-- New table: user_profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  profile_picture_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{"currency_format":"USD","date_format":"MM/DD/YYYY","onboarding_completed":false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### APIs and Interfaces

**New API Endpoints:**

**1. GET /api/transactions?all=true**
```typescript
// Fetch all user transactions for export (Story 8.1)
// Query params: ?all=true (bypasses pagination)
Response: {
  data: Transaction[];
  count: number;
}
// Implementation: src/app/api/transactions/route.ts
// Add conditional logic: if (searchParams.get('all') === 'true') skip pagination
```

**2. PUT /api/user/profile**
```typescript
// Update user profile and preferences (Story 8.3)
Request: {
  display_name?: string;
  profile_picture_url?: string;
  preferences?: Partial<UserPreferences>;
}
Response: {
  data: UserProfile;
}
// Implementation: src/app/api/user/profile/route.ts (new)
```

**3. DELETE /api/user/account**
```typescript
// Delete user account with confirmation (Story 8.3)
Request: {
  confirmation_password: string;
}
Response: {
  success: boolean;
  export_data_url?: string; // Pre-generated CSV export
}
// Implementation: src/app/api/user/account/route.ts (new)
// Logic: 1) Verify password, 2) Generate CSV, 3) Delete user_profiles, 4) Delete auth.users
```

**4. GET /api/user/sessions**
```typescript
// Get active device sessions (Story 8.4 - optional)
Response: {
  data: DeviceSession[];
}
// Implementation: src/app/api/user/sessions/route.ts (new)
// Uses: supabase.auth.admin.listUserSessions(userId)
```

**Client-Side Export Functions:**

**exportService.ts:**
```typescript
// src/lib/services/exportService.ts

export async function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: Category[]
): Promise<void> {
  // Story 8.1 implementation
  const csvData = transactions.map(tx => ({
    Date: format(new Date(tx.date), 'yyyy-MM-dd'),
    Type: tx.type,
    Category: categories.find(c => c.id === tx.category_id)?.name || 'Unknown',
    Amount: `$${tx.amount.toFixed(2)}`,
    Notes: tx.notes || '',
    'Created At': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss')
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportMonthlyReportToPDF(
  reportData: PDFReportData
): Promise<void> {
  // Story 8.2 implementation
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('Smart Budget Application', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Monthly Report - ${reportData.month}`, 105, 30, { align: 'center' });

  // Summary section
  doc.setFontSize(14);
  doc.text('Summary', 20, 45);
  doc.setFontSize(11);
  doc.text(`Total Income: $${reportData.summary.total_income.toFixed(2)}`, 20, 55);
  doc.text(`Total Expenses: $${reportData.summary.total_expenses.toFixed(2)}`, 20, 62);
  doc.text(`Net Balance: $${reportData.summary.net_balance.toFixed(2)}`, 20, 69);

  // Category table
  doc.text('Spending by Category', 20, 85);
  const tableData = reportData.categories.map(cat => [
    cat.name,
    `$${cat.amount.toFixed(2)}`,
    `${cat.percentage.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['Category', 'Amount', 'Percentage']],
    body: tableData,
  });

  // Top transactions
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.text('Top 5 Transactions', 20, finalY + 10);
  const txTableData = reportData.top_transactions.slice(0, 5).map(tx => [
    format(new Date(tx.date), 'yyyy-MM-dd'),
    tx.notes || '(no notes)',
    `$${tx.amount.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: finalY + 15,
    head: [['Date', 'Description', 'Amount']],
    body: txTableData,
  });

  doc.save(`budget-report-${reportData.month}.pdf`);
}
```

### Workflows and Sequencing

**User Flow 1: Export Transactions to CSV (Story 8.1)**
```
1. User navigates to Settings or Transactions page
2. User clicks "Export to CSV" button
3. Frontend calls GET /api/transactions?all=true
4. Client receives all transaction data
5. exportService.exportTransactionsToCSV() processes data with papaparse
6. CSV file generated in browser memory
7. Browser downloads CSV file (transactions-YYYY-MM-DD.csv)
8. Success toast displayed: "CSV exported successfully!"
```

**User Flow 2: Export Monthly PDF Report (Story 8.2)**
```
1. User navigates to Settings page
2. User selects month from dropdown (last 12 months)
3. User clicks "Export Report (PDF)"
4. Frontend calls GET /api/transactions?month=YYYY-MM
5. Frontend calls GET /api/dashboard/stats?month=YYYY-MM (aggregated data)
6. exportService.exportMonthlyReportToPDF() generates PDF with jsPDF
7. PDF includes: header, summary, category table, top 5 transactions
8. Browser downloads PDF (budget-report-YYYY-MM.pdf)
9. Success toast displayed: "PDF report downloaded!"
```

**User Flow 3: Update Profile Settings (Story 8.3)**
```
1. User navigates to /settings
2. Settings page displays:
   - Account Info (email, display name, profile picture)
   - Data Export buttons (CSV, PDF)
   - Privacy & Security info
   - Preferences (currency, date format)
3. User edits display name
4. Frontend sends PUT /api/user/profile with updated data
5. Optimistic UI update (immediate feedback)
6. Supabase updates user_profiles table
7. Success toast displayed: "Profile updated!"
```

**User Flow 4: Delete Account (Story 8.3)**
```
1. User clicks "Delete my account" in Settings
2. Confirmation modal appears with warning
3. User enters password for verification
4. User confirms deletion
5. Frontend calls DELETE /api/user/account
6. Backend verifies password with Supabase Auth
7. Backend generates CSV export of all data
8. Backend deletes user_profiles record
9. Backend deletes auth.users record (cascades to transactions, categories, insights)
10. User logged out, redirected to login page
11. Optional: CSV download initiated before logout
```

**User Flow 5: View Sync Status (Story 8.4)**
```
1. User opens app on multiple devices (desktop, mobile)
2. Dashboard header displays sync status indicator:
   - "✓ All data synced" (green) if Supabase Realtime connected
   - "Syncing..." (yellow) if connection pending
   - "Offline" (red) if navigator.onLine === false
3. Settings page shows "Last synced: X minutes ago"
4. Optional: Device list shows active sessions with revoke option
5. When user adds transaction on Device A:
   - Supabase Realtime broadcasts to Device B
   - SWR cache revalidates on Device B
   - Status updates to "Syncing..." briefly, then "✓ All data synced"
```

**User Flow 6: Offline Data Viewing (Story 8.5)**
```
1. User loads dashboard while online
2. SWR caches transaction data, categories, stats
3. Service Worker caches app shell (HTML, CSS, JS)
4. User goes offline (airplane mode, network loss)
5. User refreshes page or navigates
6. Service Worker serves cached app shell
7. SWR loads data from localStorage cache
8. Orange banner appears: "You're offline. Viewing cached data from [timestamp]"
9. Dashboard, transactions, charts render from cache (read-only)
10. Add/Edit/Delete buttons grayed out (disabled offline)
11. User reconnects to internet
12. useOnlineStatus hook detects online event
13. Banner updates: "Back online! Syncing latest data..."
14. SWR revalidates all cached data
15. Normal functionality restored
```

**Sequence Diagram: CSV Export**
```
User -> Settings Page: Click "Export CSV"
Settings Page -> API: GET /api/transactions?all=true
API -> Supabase: Query all user transactions
Supabase -> API: Return transaction data
API -> Settings Page: { data: Transaction[] }
Settings Page -> exportService: exportTransactionsToCSV(transactions, categories)
exportService -> papaparse: Papa.unparse(csvData)
papaparse -> exportService: CSV string
exportService -> Browser: Create Blob + download link
Browser -> User: Download transactions-YYYY-MM-DD.csv
Settings Page -> User: Toast "CSV exported successfully!"
```

## Non-Functional Requirements

### Performance

**Export Performance (Story 8.1, 8.2):**
- CSV export completes in <3 seconds for datasets up to 1,000 transactions
- CSV export shows progress indicator for datasets >5,000 transactions
- PDF generation completes in <5 seconds for monthly reports
- Client-side processing prevents server load and maintains privacy
- Memory-efficient processing: stream large datasets if >10,000 transactions

**Settings Page Load (Story 8.3):**
- Settings page renders in <1 second (similar to dashboard target)
- Profile updates save with <200ms optimistic UI response
- Image upload (profile picture) limited to 2MB, processed client-side

**Offline Cache (Story 8.5):**
- Service Worker installation completes in <2 seconds on first visit
- Offline page load from cache: <500ms (cached app shell)
- SWR cache retrieval from localStorage: <100ms
- Cache size limit: 50MB maximum (approximately 50,000 transactions + metadata)

### Security

**Data Export Security (Story 8.1, 8.2):**
- Client-side export processing ensures financial data never leaves user's device unencrypted
- CSV/PDF files contain sensitive data - browser download handles securely
- No server-side storage of exported files (privacy-first)
- API endpoint `/api/transactions?all=true` requires authentication (Supabase Auth JWT)
- RLS policies enforce user can only export their own data

**Account Management Security (Story 8.3):**
- Profile updates require active authenticated session
- Account deletion requires password re-entry (prevents accidental deletion)
- Account deletion verification uses Supabase Auth password check
- Deleted user data cascades correctly (ON DELETE CASCADE in schema)
- Profile picture uploads validated: file type (image/*), size (<2MB), sanitized filenames

**Session Management (Story 8.4):**
- Session list retrieved via Supabase Auth admin API (service role key server-side only)
- Session revocation uses secure Supabase Auth admin methods
- Device information doesn't expose sensitive data (only user agent + last active time)

**Offline Security (Story 8.5):**
- localStorage cache contains unencrypted financial data (browser security model)
- Cache cleared on logout to prevent data leakage
- Service Worker scope limited to app origin only
- No sensitive data in Service Worker cache (only app shell HTML/CSS/JS)

### Reliability/Availability

**Export Reliability (Story 8.1, 8.2):**
- Export failures show clear error messages (e.g., "Export failed. Please try again.")
- Large dataset exports (>5,000 transactions) chunked to prevent browser memory errors
- Retry mechanism for failed API calls during export data fetching
- Export functions handle missing data gracefully (e.g., deleted categories show "Unknown")

**Settings Page Reliability (Story 8.3):**
- Optimistic UI updates revert on API failure
- Profile picture upload failures don't break settings page
- Account deletion is transactional: either fully succeeds or fully rolls back
- Data export triggered before account deletion to ensure no data loss

**Offline Reliability (Story 8.5):**
- Service Worker fallback: if SW fails, app still functions online
- Cache corruption detection and automatic cache clearing
- Offline mode degrades gracefully: read-only access, clear indicators
- Online reconnection automatically revalidates stale cache data
- No data loss during offline-to-online transition (Phase 1 read-only ensures this)

**Availability:**
- Settings page availability: 99.9% (same as dashboard, depends on Vercel/Supabase uptime)
- Export features work entirely client-side after data fetch (resilient to backend issues)
- Offline mode provides read-only access even with zero connectivity

### Observability

**Export Monitoring:**
- Client-side error logging for export failures (console.error with context)
- Track export usage: CSV exports per day, PDF exports per day (optional analytics)
- Performance monitoring: export duration for large datasets
- User feedback: success/error toasts provide immediate visibility

**Settings Page Monitoring:**
- API error logging for profile updates (`PUT /api/user/profile` failures)
- Account deletion audit log (server-side): user_id, timestamp, success/failure
- Profile picture upload errors logged with file size and type

**Offline/Sync Monitoring:**
- Connection state changes logged: online → offline, offline → online
- SWR cache hit/miss rates tracked
- Service Worker installation success/failure logged
- Offline mode usage analytics: % of sessions with offline access

**Logging Strategy:**
- Development: console.log/warn/error for all export, settings, offline events
- Production: integrate with Sentry or LogRocket for client-side error tracking
- Server-side: pino logging for API routes (profile updates, account deletions)
- No logging of sensitive financial data (PII, transaction amounts) in production logs

## Dependencies and Integrations

**New NPM Dependencies (to be installed):**

| Package | Version | Purpose | Story |
|---------|---------|---------|-------|
| **papaparse** | ^5.4.1 | CSV parsing and generation (client-side) | Story 8.1 |
| **@types/papaparse** | ^5.3.14 | TypeScript types for papaparse | Story 8.1 |
| **jspdf** | ^2.5.2 | PDF generation (client-side) | Story 8.2 |
| **jspdf-autotable** | ^3.8.4 | Table generation for jsPDF | Story 8.2 |
| **next-pwa** | ^5.6.0 | Progressive Web App support with Service Worker | Story 8.5 |

**Installation Commands:**
```bash
# Story 8.1: CSV Export
npm install papaparse
npm install --save-dev @types/papaparse

# Story 8.2: PDF Export
npm install jspdf jspdf-autotable

# Story 8.5: Offline PWA
npm install next-pwa
```

**Existing Dependencies (reused):**
- **@supabase/supabase-js** (^2.81.1) - User profile CRUD, account deletion, session management
- **swr** (^2.3.6) - Data caching, offline cache persistence
- **date-fns** (^4.1.0) - Date formatting in exports and UI
- **@chakra-ui/react** (^2.8.0) - Settings page UI components
- **react-hook-form** (^7.66.0) + **zod** (^4.1.12) - Settings form validation
- **next** (^15.5.7) - App Router, API routes, middleware

**External Services Integration:**
- **Supabase PostgreSQL** - user_profiles table (new), RLS policies
- **Supabase Auth** - Session management API, password verification for account deletion
- **Supabase Realtime** - Connection state for sync status indicator
- **Vercel** - PWA hosting, Service Worker deployment

**Browser APIs Used:**
- **Navigator.onLine** - Online/offline status detection (Story 8.5)
- **Blob API** - CSV/PDF file generation (Story 8.1, 8.2)
- **URL.createObjectURL()** - File download mechanism
- **localStorage** - SWR cache persistence (Story 8.5)
- **Service Worker API** - Offline app shell caching (Story 8.5)

**File Dependencies:**
- Requires: `src/lib/services/transactionService.ts` (fetch transactions for export)
- Requires: `src/lib/services/categoryService.ts` (category names for CSV)
- Requires: `src/lib/supabase/server.ts` (Supabase server client for API routes)
- Creates: `src/lib/services/exportService.ts` (new)
- Creates: `src/lib/services/settingsService.ts` (new)
- Creates: `src/lib/hooks/useOnlineStatus.ts` (new)
- Creates: `src/app/api/user/profile/route.ts` (new)
- Creates: `src/app/api/user/account/route.ts` (new)
- Creates: `src/app/api/user/sessions/route.ts` (new - optional)
- Creates: `src/app/(dashboard)/settings/page.tsx` (new)
- Creates: `public/manifest.json` (new - PWA manifest)
- Modifies: `next.config.js` (add next-pwa configuration)

## Acceptance Criteria (Authoritative)

### Story 8.1: Export Transactions to CSV

**AC-8.1.1:** CSV Export Button
✅ Export button labeled "Export Transactions (CSV)" exists in Settings and/or Transactions page

**AC-8.1.2:** CSV File Download
✅ Clicking export button triggers CSV file download via browser save dialog

**AC-8.1.3:** CSV Filename Format
✅ CSV filename follows format: `transactions-YYYY-MM-DD.csv` (date of export)

**AC-8.1.4:** CSV Column Structure
✅ CSV contains columns: Date, Type, Category, Amount, Notes, Created At

**AC-8.1.5:** Complete Data Export
✅ All user transactions included (no pagination limit), sorted by date (newest first)

**AC-8.1.6:** Special Character Handling
✅ Commas in notes, quotes, and newlines properly escaped using CSV standards

**AC-8.1.7:** Currency Formatting
✅ Amount formatted as `$123.45` (no currency symbol for Excel compatibility)

**AC-8.1.8:** Date ISO Format
✅ Date column uses `YYYY-MM-DD` format (ISO 8601)

**AC-8.1.9:** Performance
✅ Export completes in <3 seconds for typical datasets (<1,000 transactions)
✅ Large datasets (>5,000) show progress indicator during export

**AC-8.1.10:** Client-Side Processing
✅ Export uses papaparse library client-side (no server processing for privacy)

**AC-8.1.11:** Success Feedback
✅ Success toast displays: "CSV exported successfully!"

### Story 8.2: Export Financial Report to PDF

**AC-8.2.1:** PDF Export Button
✅ Export button labeled "Export Monthly Report (PDF)" exists in Settings page

**AC-8.2.2:** Month Selection
✅ Month selector dropdown shows last 12 months available for export

**AC-8.2.3:** PDF Filename Format
✅ PDF filename follows format: `budget-report-YYYY-MM.pdf`

**AC-8.2.4:** PDF Content - Header
✅ PDF includes header with "Smart Budget Application" title and month/year

**AC-8.2.5:** PDF Content - Summary
✅ PDF includes summary section: Total income, total expenses, net balance

**AC-8.2.6:** PDF Content - Category Breakdown
✅ PDF includes spending by category table with amounts and percentages

**AC-8.2.7:** PDF Content - Top Transactions
✅ PDF includes top 5 highest expense transactions

**AC-8.2.8:** Professional Styling
✅ PDF styled professionally with consistent fonts, spacing, and colors

**AC-8.2.9:** Performance
✅ PDF generation completes in <5 seconds

**AC-8.2.10:** Client-Side Processing
✅ Export uses jsPDF library client-side (no server processing)

**AC-8.2.11:** Mobile Compatibility
✅ PDF formatted for A4 paper size, readable on all devices

**AC-8.2.12:** Success Feedback
✅ Success toast displays: "PDF report downloaded!"

### Story 8.3: Settings Page and Account Management

**AC-8.3.1:** Settings Route
✅ Settings page accessible at `/settings` route

**AC-8.3.2:** Account Information Section
✅ Display name (editable)
✅ Email (read-only, from auth provider)
✅ Profile picture (from social login or uploadable)
✅ Account created date

**AC-8.3.3:** Data Export Section
✅ "Export Transactions (CSV)" button
✅ "Export Monthly Report (PDF)" button with month selector

**AC-8.3.4:** Privacy & Security Section
✅ Data storage location message: "Your data is securely stored in the cloud with bank-level encryption"
✅ "Delete my account" button with confirmation requirement

**AC-8.3.5:** Preferences Section
✅ Currency format selector (default: USD)
✅ Date format selector (default: MM/DD/YYYY)
✅ "Restart onboarding tutorial" button

**AC-8.3.6:** Optimistic UI Updates
✅ All profile changes save immediately with optimistic UI updates

**AC-8.3.7:** Success Feedback
✅ Success toasts displayed for each action (profile update, preference change)

**AC-8.3.8:** Account Deletion Confirmation
✅ Delete account requires confirmation modal + password re-entry
✅ Data automatically exported before deletion
✅ User logged out and redirected to login page after deletion

**AC-8.3.9:** Mobile Responsive
✅ Full-width sections, stacked layout on mobile devices

### Story 8.4: Data Sync Status and Multi-Device Information

**AC-8.4.1:** Sync Status Indicator
✅ "✓ All data synced" (green) when connected
✅ "Syncing..." (yellow) when pending
✅ "Offline" (red) when navigator.onLine === false

**AC-8.4.2:** Last Sync Timestamp
✅ Displays "Last synced: X minutes ago" in Settings or Dashboard header

**AC-8.4.3:** Real-Time Sync Indicator
✅ Status updates when transaction added on another device (Supabase Realtime)

**AC-8.4.4:** Automatic Sync
✅ All data automatically synced via Supabase Realtime (no manual sync button needed)

**AC-8.4.5:** Optional Device List (if implemented)
✅ Settings shows list of active devices/sessions
✅ Device name (e.g., "Chrome on Windows")
✅ Last active timestamp
✅ Current device highlighted
✅ Option to revoke session (logout from device)

**AC-8.4.6:** Mobile Display
✅ Sync status visible in header or settings on mobile

### Story 8.5: Offline Data Caching for Viewing (Phase 1)

**AC-8.5.1:** Offline Data Access
✅ Previously loaded dashboard, transactions, and categories available offline

**AC-8.5.2:** Offline Indicator
✅ Banner displays: "You're offline. Viewing cached data from [timestamp]"
✅ Offline indicator in header (red badge or icon)

**AC-8.5.3:** Read-Only Mode
✅ Add/edit/delete buttons disabled offline (grayed out)
✅ Charts render from cached data

**AC-8.5.4:** Reconnection Behavior
✅ Banner updates: "Back online! Syncing latest data..." when connection restored
✅ Data automatically refreshes on reconnection

**AC-8.5.5:** Service Worker Caching
✅ Service Worker caches static assets (HTML, CSS, JS) for offline app shell

**AC-8.5.6:** SWR Cache Persistence
✅ SWR cache persists data across page refreshes using localStorage

**AC-8.5.7:** PWA Installability
✅ App installable as PWA on mobile (Add to Home Screen)
✅ `manifest.json` configured with app metadata

**AC-8.5.8:** Performance
✅ Offline page load from cache: <500ms
✅ SWR cache retrieval: <100ms

## Traceability Mapping

| FR | Requirement Description | Story | AC | Component/API | Test Idea |
|----|------------------------|-------|-----|---------------|-----------|
| **FR38** | Store data securely in cloud with RLS | 8.3, 8.4 | AC-8.3.4, AC-8.4.4 | user_profiles table, RLS policies | Verify RLS prevents cross-user access |
| **FR39** | Export transactions to CSV | 8.1 | AC-8.1.1 to AC-8.1.11 | exportService.exportTransactionsToCSV(), papaparse | Test CSV structure, special chars, performance |
| **FR40** | Export reports to PDF | 8.2 | AC-8.2.1 to AC-8.2.12 | exportService.exportMonthlyReportToPDF(), jsPDF | Test PDF content, styling, download |
| **FR41** | Indicate data storage and protection | 8.3 | AC-8.3.4 | Settings page Privacy section | Verify clear messaging displayed |
| **FR42** | Data persists and syncs across devices | 8.4 | AC-8.4.1 to AC-8.4.6 | Supabase Realtime, sync status indicator | Test multi-device sync, real-time updates |
| **FR43** | Automatic sync across logged-in devices | 8.4 | AC-8.4.4 | Supabase Realtime subscriptions | Test transaction added on Device A appears on Device B |
| **FR47** | Cache data for offline viewing | 8.5 | AC-8.5.1 to AC-8.5.8 | Service Worker, SWR cache, useOnlineStatus hook | Test offline page load, cache retrieval, reconnection |

**Component Mapping:**

| Component/Module | Stories | Test Coverage |
|------------------|---------|---------------|
| **exportService.ts** | 8.1, 8.2 | Unit tests: CSV generation, PDF generation, error handling |
| **settingsService.ts** | 8.3 | Unit tests: Profile updates, preference changes |
| **offlineService.ts** | 8.5 | Integration tests: Service Worker installation, cache management |
| **useOnlineStatus hook** | 8.4, 8.5 | Unit tests: Online/offline detection, last sync tracking |
| **Settings Page** | 8.1, 8.2, 8.3, 8.4 | E2E tests: Full settings workflow, export flows |
| **PUT /api/user/profile** | 8.3 | API tests: Valid/invalid profile updates, auth checks |
| **DELETE /api/user/account** | 8.3 | API tests: Password verification, cascading deletion |
| **GET /api/transactions?all=true** | 8.1 | API tests: Returns all user transactions, respects RLS |
| **user_profiles table** | 8.3 | DB tests: RLS policies, CRUD operations |

## Risks, Assumptions, Open Questions

### Risks

**RISK-8.1:** CSV Export Memory Limitations (Story 8.1)
- **Impact:** High - Large datasets (>10,000 transactions) may crash browser tab
- **Likelihood:** Medium - Power users with multi-year data
- **Mitigation:** Implement streaming/chunking for large exports, add dataset size warning

**RISK-8.2:** PDF Generation Performance (Story 8.2)
- **Impact:** Medium - Slow PDF generation degrades UX
- **Likelihood:** Medium - Monthly reports with complex data
- **Mitigation:** Optional chart images (user toggle), progress indicator, performance benchmarking

**RISK-8.3:** Service Worker Cache Staleness (Story 8.5)
- **Impact:** High - Users see outdated data offline
- **Likelihood:** Low - SWR revalidation on reconnect handles this
- **Mitigation:** Display cache timestamp, force refresh button, automatic cache invalidation after 7 days

**RISK-8.4:** Account Deletion Irreversibility (Story 8.3)
- **Impact:** Critical - User loses all data permanently
- **Likelihood:** Low - Strong confirmation flow prevents accidental deletion
- **Mitigation:** Multi-step confirmation, password verification, automatic data export before deletion

**RISK-8.5:** Browser Compatibility - Service Workers (Story 8.5)
- **Impact:** Medium - Offline features unavailable in older browsers
- **Likelihood:** Low - Target browsers (Chrome, Safari, Firefox latest 2) support SW
- **Mitigation:** Progressive enhancement, graceful degradation, clear browser requirements messaging

### Assumptions

**ASSUME-8.1:** User Profile Storage
- **Assumption:** user_profiles table is acceptable approach vs storing in auth.users metadata
- **Validation:** Confirm with architecture during Story 8.3 implementation
- **Alternative:** Use Supabase Auth user metadata if simpler

**ASSUME-8.2:** Client-Side Export Sufficient
- **Assumption:** Client-side CSV/PDF generation meets privacy goals and performs adequately
- **Validation:** Performance testing with 1,000, 5,000, and 10,000 transaction datasets
- **Fallback:** Server-side export if client-side performance unacceptable

**ASSUME-8.3:** PWA vs Native App
- **Assumption:** PWA offline capabilities sufficient for MVP (no native mobile app needed yet)
- **Validation:** User feedback on offline experience quality
- **Future:** Native apps considered for Phase 2 if PWA insufficient

**ASSUME-8.4:** USD Currency Only (MVP)
- **Assumption:** Single currency (USD) acceptable for MVP launch
- **Validation:** User demographics confirm USD is primary need
- **Backlog:** Multi-currency support planned for post-MVP

**ASSUME-8.5:** SWR Cache for Offline (not IndexedDB)
- **Assumption:** SWR + localStorage sufficient for offline caching
- **Validation:** Performance testing with cache sizes up to 50MB
- **Alternative:** IndexedDB if localStorage size limits become issue

### Open Questions

**QUESTION-8.1:** Device Session Management Scope
- **Question:** Should Story 8.4 include full session management (list devices, revoke sessions)?
- **Options:** (A) Basic sync status only, (B) Full device list + revoke
- **Decision Needed:** Before starting Story 8.4
- **Owner:** Product/Niki

**QUESTION-8.2:** Profile Picture Storage
- **Question:** Where to store uploaded profile pictures? Supabase Storage vs external CDN?
- **Options:** (A) Supabase Storage, (B) Cloudinary/Imgix, (C) Base64 in database (not recommended)
- **Decision Needed:** Before Story 8.3 implementation
- **Owner:** Technical/Architecture

**QUESTION-8.3:** Offline Write Queue (Phase 2)
- **Question:** When to implement offline transaction creation with sync queue?
- **Decision:** Defer to separate epic after Epic 8 (Phase 1 read-only validated first)
- **Owner:** Product roadmap

**QUESTION-8.4:** Export Format Options
- **Question:** Should users be able to customize CSV columns or PDF layout?
- **Decision:** Not in MVP - standardized formats only, gather feedback post-launch
- **Owner:** UX/Product

## Test Strategy Summary

### Unit Tests

**Export Service Tests (Story 8.1, 8.2):**
```typescript
// exportService.test.ts
describe('exportTransactionsToCSV', () => {
  test('generates valid CSV with correct headers');
  test('formats dates as YYYY-MM-DD');
  test('formats amounts with $ symbol');
  test('escapes special characters (commas, quotes)');
  test('handles empty notes field (empty string)');
  test('handles missing categories gracefully');
  test('sorts transactions by date descending');
});

describe('exportMonthlyReportToPDF', () => {
  test('generates PDF with all required sections');
  test('calculates summary totals correctly');
  test('formats category table with percentages');
  test('includes top 5 transactions only');
  test('handles empty month (no transactions)');
});
```

**Settings Service Tests (Story 8.3):**
```typescript
// settingsService.test.ts
describe('updateUserProfile', () => {
  test('updates display name successfully');
  test('validates profile picture file size');
  test('saves preferences to JSONB field');
  test('handles API errors gracefully');
});
```

**useOnlineStatus Hook Tests (Story 8.4, 8.5):**
```typescript
// useOnlineStatus.test.ts
describe('useOnlineStatus', () => {
  test('returns true when navigator.onLine is true');
  test('returns false when offline');
  test('updates state on online/offline events');
  test('tracks last sync timestamp');
});
```

### Integration Tests

**Settings Page Flow (Story 8.3):**
- Render settings page with user data loaded
- Edit display name → verify optimistic UI → verify API called
- Upload profile picture → verify file validation → verify save
- Change preferences → verify immediate save
- Click account deletion → verify confirmation modal → verify password prompt

**Export Flow Integration (Story 8.1, 8.2):**
- Fetch all transactions from API
- Generate CSV → verify download triggered
- Select month → generate PDF → verify download triggered
- Handle API errors → display error toast

**Offline Mode Integration (Story 8.5):**
- Load dashboard online → verify cache populated
- Go offline → verify banner displayed
- Navigate pages → verify cached data loads
- Go back online → verify sync and revalidation

### End-to-End Tests (Playwright)

**E2E-8.1:** CSV Export Flow
```typescript
test('user can export transactions to CSV', async ({ page }) => {
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export Transactions (CSV)")');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/transactions-\d{4}-\d{2}-\d{2}\.csv/);
});
```

**E2E-8.2:** PDF Report Export
```typescript
test('user can export monthly PDF report', async ({ page }) => {
  await page.goto('/settings');
  await page.selectOption('select[name="month"]', '2025-12');
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export Report (PDF)")');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('budget-report-2025-12.pdf');
});
```

**E2E-8.3:** Account Deletion Flow
```typescript
test('user can delete account with confirmation', async ({ page }) => {
  await page.goto('/settings');
  await page.click('button:has-text("Delete my account")');
  await expect(page.locator('text=Are you sure?')).toBeVisible();
  await page.fill('input[name="password"]', 'correctpassword');
  await page.click('button:has-text("Confirm Deletion")');
  await expect(page).toHaveURL('/login');
});
```

**E2E-8.5:** Offline Mode
```typescript
test('user can view cached data offline', async ({ page, context }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('text=You\'re offline')).toBeVisible();
  await expect(page.locator('[data-testid="transaction-list"]')).toBeVisible();
  await expect(page.locator('button:has-text("Add Transaction")')).toBeDisabled();
});
```

### Performance Tests

**Export Performance Benchmarks:**
- CSV export with 100 transactions: <500ms
- CSV export with 1,000 transactions: <3 seconds
- CSV export with 5,000 transactions: <10 seconds (with progress indicator)
- PDF generation: <5 seconds

**Offline Cache Performance:**
- Service Worker install: <2 seconds
- Cached page load: <500ms
- SWR cache read from localStorage: <100ms

### Manual Testing Checklist

**Story 8.1 - CSV Export:**
- [ ] Export button exists and labeled correctly
- [ ] CSV downloads with correct filename format
- [ ] CSV opens in Excel/Google Sheets without errors
- [ ] Special characters in notes display correctly
- [ ] Empty notes show as empty cells (not "null")
- [ ] All user transactions included (verify count)
- [ ] Performance acceptable with 1,000+ transactions

**Story 8.2 - PDF Export:**
- [ ] PDF downloads with correct filename
- [ ] PDF opens in viewer (browser, Adobe Reader)
- [ ] All sections present (header, summary, categories, transactions)
- [ ] Professional styling (fonts, spacing, alignment)
- [ ] PDF readable on mobile device

**Story 8.3 - Settings Page:**
- [ ] Settings page renders all sections
- [ ] Profile updates save successfully
- [ ] Account deletion works with correct password
- [ ] Account deletion fails with wrong password
- [ ] Data exported before deletion
- [ ] Mobile responsive layout verified

**Story 8.4 - Sync Status:**
- [ ] Sync indicator shows correct status (online/offline)
- [ ] Last sync timestamp updates
- [ ] Multi-device sync tested (desktop + mobile)

**Story 8.5 - Offline Mode:**
- [ ] App loads offline after initial online visit
- [ ] Offline banner displays with timestamp
- [ ] Cached data displays correctly
- [ ] Add/edit buttons disabled offline
- [ ] Reconnection triggers sync and data refresh

### Acceptance Testing

Each story's acceptance criteria (AC-8.1.1 through AC-8.5.8) will be verified during story implementation before marking as "Done". Developer will test against AC checklist, and Senior Manager will review during code review workflow.
