---
name: Smart Budget — Mobile Shell
status: final
updated: 2026-06-03
references: DESIGN.md
ui_system: Chakra UI
form_factor: multi-surface (mobile / tablet / desktop) — this spec defines the MOBILE (base breakpoint, <768px) shell delta
---

# Smart Budget — Mobile Shell · EXPERIENCE.md

> How the mobile shell *works*. Visual identity lives in `DESIGN.md`; tokens referenced as `{token}`. Scope: navigation, safe-area behavior, and the account surface on mobile. Desktop/tablet (≥ md) behavior is unchanged. Spine wins on conflict.

## Foundation

- **UI system:** Chakra UI. The shell uses Chakra `Drawer`, `Box`, `Flex`, `IconButton`. Only behavioral deltas are specified here.
- **Form factor:** multi-surface. Mobile (`base`, <768px) gets the bottom-tab shell defined here. Tablet/desktop (`md`+) keep the existing collapsible **Sidebar** + floating action button — out of scope, unchanged.
- **PWA context:** installed standalone on iOS with `viewport-fit=cover` and `black-translucent` status bar — so the app is responsible for all safe-area insets (see DESIGN.md Layout & Spacing).

## Information Architecture

**Mobile primary navigation = one bottom tab bar. No hamburger drawer.**

| Tab | Route | Role |
|-----|-------|------|
| Dashboard | `/dashboard` | Home — stats, AI cards |
| Transactions | `/transactions` | Ledger + filters |
| **Add** (center, elevated) | — | Opens transaction entry modal |
| Insights | `/insights` | AI insights + subscriptions |
| Settings | `/settings` | Preferences, account, notifications |

**Secondary destinations** (not primary tabs): **Categories** is reached from Transactions (manage-categories entry) and/or Settings — not a bottom tab (decided 2026-06-03). The hamburger drawer is removed entirely on mobile.

**Account actions** (email, account/settings, sign out) move from the top-right dropdown into an **account bottom-sheet** opened from the header avatar.

Surface closure: every primary need (see-finances → Dashboard; log → Add; review-history → Transactions; coaching → Insights; configure → Settings; manage-account → account sheet) has exactly one mobile entry point. The hamburger drawer is removed; nothing it uniquely held is lost (Categories rehomed; account moved to sheet).

## Voice and Tone

Microcopy stays minimal and calm. Tab labels are single words (Dashboard, Transactions, Add, Insights, Settings). The account sheet uses plain labels ("Account", "Sign out"). No marketing voice in the shell. (Brand voice lives in DESIGN.md.Brand & Style.)

## Component Patterns (behavioral)

### Header
- Sticky at top; remains visible while content scrolls.
- Left: app title only on mobile (the hamburger is removed).
- Right: avatar `IconButton` → opens the account bottom-sheet (not a dropdown menu).
- Content is pushed below the Dynamic Island via top safe-area padding ({spacing.safe_top}); the blue fill bleeds into the inset.

### Bottom tab bar
- Visible only on `base` (<768px); hidden ≥ md.
- Tapping a tab routes immediately (one tap — no intermediate menu).
- Active state derived from current route (`pathname === href || startsWith(href + '/')`), shown via `{colors.primary}` + bolder label.
- Center **Add** is not a route — it opens the transaction modal.
- Persists across all authenticated routes.

### Account bottom-sheet
- Opens from header avatar; Chakra `Drawer placement="bottom"`.
- Dismiss: swipe-down, scrim tap, or explicit close.
- Rows: email (read-only, muted) → Account/Settings (routes to `/settings`) → Sign out (destructive). Sign out triggers the existing logout flow.
- Focus is trapped while open; returns to the avatar on close.

### Center Add FAB
- Opens transaction entry modal; on success, existing dashboard-refresh behavior runs.

## State Patterns

- **Active tab:** color + label-weight change (never color alone).
- **Loading/route transition:** instant client nav; existing per-page skeletons handle content load.
- **Offline:** existing OfflineBanner remains below the header; tab bar stays usable.
- **Sheet open/closed:** body scroll locked while the account sheet is open (Chakra default).
- **Safe-area absent (older devices / Android):** `env(safe-area-inset-*)` resolves to 0 → header/tab bar render with base padding, no layout break.

## Interaction Primitives

- **Tap** — primary nav + Add + account rows.
- **Swipe-down** — dismiss the account sheet.
- **Scroll** — content region only; `overscroll-behavior-y: none` prevents whole-page rubber-banding behind the fixed chrome.
- **One-handed reach** — all primary actions live in the bottom third; the only top-anchored control (avatar) opens a bottom sheet, so the actual choices are thumb-reachable.

## Accessibility Floor (behavioral)

- All nav targets ≥ 48×48 (kept).
- `aria-current="page"` on the active tab; `aria-label` per tab from i18n.
- Account sheet: focus trap, labelled close, ESC/scrim dismiss.
- State conveyed by color **and** weight/label (color never sole signal) — DESIGN.md owns contrast.
- Restore pinch-zoom (drop `maximumScale: 1`) for WCAG resize support (decided 2026-06-03).
- Respect `prefers-reduced-motion` for sheet/FAB transitions.

## Key Flows

### Flow 1 — Nikit logs a coffee one-handed on the train (the core loop)
1. Nikit opens the installed PWA on his iPhone 15; the blue header sits cleanly **below** the Dynamic Island (not under it).
2. Thumb resting low, he taps the elevated **+ Add** in the bottom bar.
3. The transaction modal opens; he enters $4.50 / Dining and saves — under 30 seconds.
4. **Climax:** the dashboard refreshes and a Smart Nudge slides in — all reachable without his thumb ever leaving the bottom third of the screen, and nothing was hidden behind the Dynamic Island or the home indicator.
5. He taps **Insights**, then **Dashboard** — each one tap, no hamburger detour.

### Flow 2 — Nikit signs out from a borrowed phone
1. He taps his avatar (top-right).
2. Instead of a cramped dropdown, an **account bottom-sheet** rises from the bottom.
3. **Climax:** "Sign out" sits squarely under his thumb; one tap logs him out and returns to `/login`.

## Responsive & Platform

- **Mobile (<768px):** bottom-tab shell (this spec). Sidebar + FAB hidden.
- **Tablet/Desktop (≥768px):** existing collapsible Sidebar + FAB; bottom bar + account sheet hidden. No change.
- **iOS standalone PWA:** full safe-area handling per DESIGN.md; `100dvh` shell.
- **Android/other:** `env()` insets resolve to 0; identical layout, no breakage.

## Inspiration & Anti-patterns

- **Follow:** Apple HIG / Material bottom tab bar for 3–5 primary destinations; native iOS translucent bars.
- **Avoid:** dual navigators (hamburger + tabs); top-corner primary actions; `100vh` on mobile; content under the Dynamic Island. (Grounding in `.decision-log.md` research notes.)
