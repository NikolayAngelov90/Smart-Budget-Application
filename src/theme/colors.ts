// ============================================================================
// QUIET LEDGER — palette (frontend redesign)
// ----------------------------------------------------------------------------
// A calm, premium personal-finance identity. The old "Trust Blue" admin look is
// replaced by an evergreen "money" accent set on warm paper. The emotional move:
// money that flows OUT is warm clay, not alarm-red — this is a ledger, not a
// banking alarm system. True red is reserved for genuine errors / destructive
// actions only.
//
// The `brand` + `trustBlue` scales are intentionally REMAPPED to the evergreen
// ramp. Every existing `colorScheme="trustBlue"`, `trustBlue.500`, `brand.500`,
// focus ring, spinner and link across the app inherits the new identity for free.
// ============================================================================

// Evergreen — the primary accent. Reads as growth, calm and trust without the
// corporate-banking-blue baggage. 500 is dark enough to carry white text (AA).
const evergreen = {
  50: '#E9F3EF',
  100: '#CDE5DC',
  200: '#9FCCBD',
  300: '#6BB09A',
  400: '#3C9179',
  500: '#0B5E4A', // primary
  600: '#0A5341',
  700: '#084435',
  800: '#06342A',
  900: '#04241D',
};

// Warm clay — the "money out" semantic. Muted, non-judgmental, never alarming.
const clay = {
  50: '#FBEFEA',
  100: '#F4D7CB',
  200: '#E7B29E',
  300: '#D98A6D',
  400: '#CE6C49',
  500: '#C4593A', // expense
  600: '#AC4C30',
  700: '#8C3D27',
  800: '#6B2F1F',
  900: '#4A2016',
};

// Amber — attention / warning that isn't a red-flag panic.
const amber = {
  50: '#FBF3E2',
  100: '#F6E3BC',
  200: '#EFCB85',
  300: '#E7B355',
  400: '#DDA13F',
  500: '#C9862A',
  600: '#A96E20',
  700: '#85561A',
  800: '#5F3E13',
  900: '#3E280C',
};

export const colors = {
  // ── Base canvas / ink ──────────────────────────────────────────────────
  // Warm paper, NOT the AI-default cream. Cards read with quiet depth on top.
  canvas: '#F6F5F2',
  ink: '#1A1C1A',

  // Full neutral ramp — warm-tinted grays so the whole UI feels of one material.
  paper: {
    0: '#FFFFFF',
    50: '#F6F5F2',
    100: '#EDECE7',
    200: '#E1DFD8',
    300: '#CFCCC2',
    400: '#A8A49A',
    500: '#847F74',
    600: '#5F5B52',
    700: '#443F38', // ink for dark surfaces
    800: '#26241F',
    850: '#1B1A16',
    900: '#111008',
  },

  evergreen,
  clay,
  amber,

  // Semantic finance colors (used by redesigned components directly).
  income: evergreen,
  expense: clay,

  // Remap the legacy scales so the identity cascades app-wide.
  trustBlue: evergreen,
  brand: evergreen,
};
