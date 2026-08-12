---
name: Smart Budget — Mobile Shell
status: final
updated: 2026-06-03
ui_system: Chakra UI (theme at src/theme) — tokens below reference/extend it
colors:
  primary: "#2b6cb0"        # trustBlue.500 — main brand
  primary_hover: "#1e88e5"  # trustBlue.600
  primary_active: "#1976d2" # trustBlue.700
  primary_subtle: "#e3f2fd" # trustBlue.50 — active-nav wash
  on_primary: "#ffffff"
  surface: "#ffffff"
  surface_muted: "#f7fafc"  # gray.50
  border: "#e2e8f0"         # gray.200
  text: "#1a202c"           # gray.800
  text_muted: "#718096"     # gray.500
  success: "#38a169"        # green.500
  warning: "#dd6b20"        # orange.500
  nav_scrim: "rgba(255,255,255,0.82)" # translucent tab/header fill behind blur
typography:
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  nav_label: "10px / 600 (active) · 10px / 400 (inactive)"
  header_title: "1.25rem / 700"
rounded:
  sheet: "16px"     # bottom-sheet top corners
  fab: "9999px"     # center Add button
  control: "8px"
spacing:
  safe_top: "env(safe-area-inset-top)"
  safe_bottom: "env(safe-area-inset-bottom)"
  safe_x: "env(safe-area-inset-left) / env(safe-area-inset-right)"
  header_pad_y: "0.75rem"
  tabbar_height: "56px"
components:
  - header
  - bottom-tab-bar
  - account-bottom-sheet
  - center-add-fab
---

# Smart Budget — Mobile Shell · DESIGN.md

> Scope: the **mobile (base breakpoint) app shell** — header, navigation, safe areas. Inherits the existing Chakra UI theme and Trust Blue identity; this spine specifies only the mobile-shell visual deltas. Desktop/tablet (≥ md) visuals are unchanged. Spine wins on conflict with any mock.

## Brand & Style

Calm, trustworthy fintech. The brand color is **Trust Blue** (`{colors.primary}`), already established across Phase 1–2. The mobile shell should feel **native to iOS** — edge-to-edge, respectful of the Dynamic Island, thumb-first. Visual tone: clean white surfaces, soft elevation, one confident accent. No new colors, gradients, or motifs introduced here.

## Colors

Inherit the Chakra `trustBlue` / `gray` / semantic scales (`src/theme/colors.ts`). Shell-specific roles:

| Role | Token | Value |
|------|-------|-------|
| Primary / active nav icon+label | `{colors.primary}` | #2b6cb0 |
| Active-tab wash (optional pill) | `{colors.primary_subtle}` | #e3f2fd |
| Inactive nav icon+label | `{colors.text_muted}` | #718096 |
| Header background | `{colors.primary}` | #2b6cb0 (fills the safe-area/Dynamic Island region) |
| Header foreground | `{colors.on_primary}` | #ffffff |
| Tab bar / sheet surface | `{colors.surface}` over `{colors.nav_scrim}` | white @ 82% behind blur |
| At-risk / warning accent | `{colors.warning}` | #dd6b20 |
| On-track / success accent | `{colors.success}` | #38a169 |

## Typography

System font stack (`{typography.family}`) — matches iOS San Francisco when installed, zero web-font cost. Header title `{typography.header_title}`. Tab labels `{typography.nav_label}` — tiny, uppercase-weight contrast between active/inactive carries state alongside color (never color alone).

## Layout & Spacing

- **Root shell height:** `100dvh` (dynamic viewport) — never `100vh`. The scrollable content region uses `overscroll-behavior-y: none`.
- **Safe areas (the core fix):**
  - Header: `padding-top: calc({spacing.header_pad_y} + {spacing.safe_top})`; the blue fill extends into the Dynamic Island region while content sits below it.
  - Bottom tab bar: `padding-bottom: {spacing.safe_bottom}` (home indicator) + left/right insets for landscape notch.
  - Main scroll region: bottom padding ≥ `tabbar_height + safe_bottom` so content never hides behind the bar.
- **Tab bar height:** `{spacing.tabbar_height}` content + safe-area inset below.

## Elevation & Depth

- Header: subtle bottom shadow (`boxShadow="sm"`) — unchanged.
- Bottom tab bar: hairline top border (`{colors.border}`) + **translucent blur** (`backdrop-filter: blur(12px)`, background `{colors.nav_scrim}`) for a native floating feel. Fallback to solid white where blur is unsupported.
- Center **Add** FAB: elevated, `box-shadow: 0 4px 12px rgba(43,108,176,0.45)`, pulled `-24px` above the bar (existing treatment, kept).
- Account bottom-sheet: standard Chakra Drawer elevation; rounded top corners `{rounded.sheet}`.

## Shapes

- Center Add: full circle (`{rounded.fab}`), 52×52.
- Bottom-sheet: top corners `{rounded.sheet}`; handle affordance (4px × 36px pill) centered at top.
- Controls/cards in shell: `{rounded.control}`.

## Components

### Header
Sticky, full-width, `{colors.primary}` background, white foreground. Left: app title (hamburger removed on mobile — see EXPERIENCE.md IA). Right: avatar button that opens the **account bottom-sheet**. Top padding includes `{spacing.safe_top}`.

### Bottom tab bar
Fixed, full-width, translucent-blurred white. Four destinations + elevated center Add: **Dashboard · Transactions · (Add) · Insights · Settings**. Active item uses `{colors.primary}` icon + `600` label; inactive `{colors.text_muted}` + `400`. ≥48×48 targets. `padding-bottom: {spacing.safe_bottom}`.

### Account bottom-sheet
Chakra Drawer `placement="bottom"`, rounded top `{rounded.sheet}`, drag-handle affordance. Contents: user email (muted), Account/Settings row, Sign out row (destructive text color). Opens from header avatar; dismiss by swipe-down, scrim tap, or close.

### Center Add FAB
Circular `{colors.primary}`, white `+`, elevated per Elevation. Opens the transaction entry modal.

## Do's and Don'ts

- ✅ Do let the blue header fill the Dynamic Island region; pad content below with `{spacing.safe_top}`.
- ✅ Do use `100dvh`, never `100vh`, for the shell.
- ✅ Do keep one primary nav on mobile (bottom tabs).
- ✅ Do carry nav state with color **and** label weight (a11y).
- ❌ Don't anchor primary actions to the top corners on mobile.
- ❌ Don't run two parallel navigators (hamburger + tabs).
- ❌ Don't introduce new brand colors — extend the Trust Blue/Chakra scale only.
