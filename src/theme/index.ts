import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { colors } from './colors';

// ============================================================================
// QUIET LEDGER — Chakra theme (frontend redesign)
// ----------------------------------------------------------------------------
// One coherent design system, expressed as theme tokens + component variants so
// it cascades across every screen. Semantic tokens carry a full dark-mode set,
// so the system is dark-ready even though light ships as the default.
// ============================================================================

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// Font stacks. Space Grotesk leads for display/amounts; Onest is the Cyrillic-
// capable fallback (so Bulgarian headings degrade gracefully) and the body face.
const SANS = `var(--font-onest), -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const DISPLAY = `var(--font-space-grotesk), var(--font-onest), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

const theme = extendTheme({
  config,

  colors,

  // ── Semantic tokens: single source of truth for surfaces, ink & lines. ────
  // Every value has a `_dark` counterpart, so the whole app is dark-ready.
  semanticTokens: {
    colors: {
      'canvas': { default: 'canvas', _dark: 'paper.900' },
      'surface': { default: 'paper.0', _dark: 'paper.850' },
      'surface.raised': { default: 'paper.0', _dark: 'paper.800' },
      'surface.sunken': { default: 'paper.100', _dark: 'paper.900' },
      'surface.hover': { default: 'paper.50', _dark: 'paper.800' },

      'fg': { default: 'ink', _dark: 'paper.50' },
      'fg.muted': { default: 'paper.600', _dark: 'paper.400' },
      'fg.subtle': { default: 'paper.500', _dark: 'paper.500' },
      'fg.onAccent': { default: 'white', _dark: 'white' },

      'border': { default: 'paper.200', _dark: 'paper.800' },
      'border.strong': { default: 'paper.300', _dark: 'paper.700' },

      'accent': { default: 'evergreen.500', _dark: 'evergreen.300' },
      'accent.emphasis': { default: 'evergreen.600', _dark: 'evergreen.400' },
      'accent.subtle': { default: 'evergreen.50', _dark: 'rgba(11,94,74,0.22)' },

      // Finance semantics.
      'income': { default: 'evergreen.500', _dark: 'evergreen.300' },
      'income.subtle': { default: 'evergreen.50', _dark: 'rgba(11,94,74,0.22)' },
      'expense': { default: 'clay.500', _dark: 'clay.300' },
      'expense.subtle': { default: 'clay.50', _dark: 'rgba(196,89,58,0.20)' },
      'warning.fg': { default: 'amber.600', _dark: 'amber.300' },
      'warning.subtle': { default: 'amber.50', _dark: 'rgba(201,134,42,0.18)' },
    },
  },

  fonts: {
    heading: DISPLAY,
    body: SANS,
    mono: `"Space Grotesk", ui-monospace, SFMono-Regular, Menlo, monospace`,
  },

  // Type scale — deliberate steps, not a wall of bold.
  fontSizes: {
    '2xs': '0.6875rem', // 11px — metadata / eyebrow
    xs: '0.75rem', // 12px
    sm: '0.8125rem', // 13px
    md: '0.9375rem', // 15px — base body
    lg: '1.0625rem', // 17px
    xl: '1.25rem', // 20px — section title
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.375rem', // 38px
    '5xl': '3rem', // 48px — hero amount (mobile)
    '6xl': '3.75rem', // 60px — hero amount (desktop)
  },

  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  letterSpacings: {
    tighter: '-0.03em',
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.08em', // eyebrow labels
  },

  radii: {
    // Considered, not "everything is a pill". Cards get a calm 16–20px.
    none: '0',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '26px',
    full: '9999px',
  },

  shadows: {
    // Soft, low, wide — depth without drama.
    xs: '0 1px 2px rgba(26,28,26,0.04)',
    sm: '0 1px 3px rgba(26,28,26,0.05), 0 1px 2px rgba(26,28,26,0.04)',
    md: '0 4px 16px -6px rgba(26,28,26,0.10), 0 2px 6px -3px rgba(26,28,26,0.06)',
    lg: '0 12px 32px -12px rgba(26,28,26,0.14), 0 4px 12px -6px rgba(26,28,26,0.08)',
    xl: '0 24px 56px -20px rgba(26,28,26,0.20)',
    accent: '0 8px 24px -8px rgba(11,94,74,0.45)',
    focus: '0 0 0 3px rgba(11,94,74,0.30)',
  },

  // ── Global styles ─────────────────────────────────────────────────────────
  styles: {
    global: {
      'html, body': {
        bg: 'canvas',
        color: 'fg',
      },
      body: {
        fontFamily: 'body',
        fontSize: 'md',
        lineHeight: 1.55,
        WebkitFontSmoothing: 'antialiased',
        textRendering: 'optimizeLegibility',
      },
      // Financial figures: tabular, lining, so columns of money align.
      '.tnum': {
        fontFeatureSettings: '"tnum" 1, "lnum" 1',
        fontVariantNumeric: 'tabular-nums lining-nums',
      },
      '::selection': {
        background: 'rgba(11,94,74,0.18)',
      },
      // Quiet, consistent scrollbars.
      '*::-webkit-scrollbar': { width: '10px', height: '10px' },
      '*::-webkit-scrollbar-thumb': {
        background: 'rgba(26,28,26,0.16)',
        borderRadius: '9999px',
        border: '2px solid transparent',
        backgroundClip: 'padding-box',
      },
    },
  },

  // ── Component variants ────────────────────────────────────────────────────
  components: {
    Heading: {
      baseStyle: {
        fontFamily: 'heading',
        fontWeight: 600,
        letterSpacing: 'tight',
        color: 'fg',
      },
    },

    Text: {
      baseStyle: { color: 'fg' },
    },

    // The reusable surface. `<Card>` (Chakra multipart) — we set part styles.
    Card: {
      baseStyle: {
        container: {
          bg: 'surface',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'border',
          boxShadow: 'sm',
        },
      },
      variants: {
        // The default look used across the app.
        elevated: {
          container: { boxShadow: 'md', borderColor: 'transparent' },
        },
        outline: {
          container: { boxShadow: 'none', borderColor: 'border' },
        },
        // Quietly tinted panel for AI / highlighted content.
        accent: {
          container: {
            bg: 'accent.subtle',
            borderColor: 'transparent',
            boxShadow: 'none',
          },
        },
      },
      defaultProps: { variant: 'outline' },
    },

    Button: {
      baseStyle: {
        fontFamily: 'body',
        fontWeight: 600,
        borderRadius: 'lg',
        letterSpacing: '-0.01em',
        _focusVisible: { boxShadow: 'focus' },
      },
      sizes: {
        lg: { h: '52px', minW: '52px', fontSize: 'md', px: 6 },
        md: { h: '44px', minW: '44px', fontSize: 'md', px: 5 },
        sm: { h: '38px', minW: '38px', fontSize: 'sm', px: 4 },
      },
      variants: {
        // Primary evergreen action.
        solid: (props: { colorScheme?: string }) => {
          if (props.colorScheme && props.colorScheme !== 'gray' && props.colorScheme !== 'brand' && props.colorScheme !== 'trustBlue') {
            return {}; // let Chakra handle red/green/etc. (alerts, destructive)
          }
          return {
            bg: 'accent',
            color: 'white',
            _hover: { bg: 'accent.emphasis', _disabled: { bg: 'accent' } },
            _active: { bg: 'evergreen.700' },
          };
        },
        outline: {
          borderColor: 'border.strong',
          color: 'fg',
          _hover: { bg: 'surface.hover' },
        },
        ghost: {
          color: 'fg.muted',
          _hover: { bg: 'surface.hover', color: 'fg' },
        },
        // Soft evergreen fill — secondary emphasis.
        soft: {
          bg: 'accent.subtle',
          color: 'accent.emphasis',
          _hover: { bg: 'evergreen.100' },
          _active: { bg: 'evergreen.200' },
        },
      },
      defaultProps: { colorScheme: 'brand' },
    },

    Input: {
      defaultProps: { focusBorderColor: 'accent' },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'accent' },
    },
    Select: {
      defaultProps: { focusBorderColor: 'accent' },
    },

    Link: {
      baseStyle: {
        color: 'accent',
        _hover: { textDecoration: 'none', color: 'accent.emphasis' },
      },
    },

    Divider: {
      baseStyle: { borderColor: 'border', opacity: 1 },
    },

    Tooltip: {
      baseStyle: {
        bg: 'ink',
        color: 'white',
        borderRadius: 'md',
        px: 3,
        py: 2,
        fontSize: 'sm',
        boxShadow: 'lg',
      },
    },
  },
});

export default theme;
