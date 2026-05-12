/**
 * NILIN Design Tokens
 * Based on luxury minimal aesthetic from BLONDIES campaign references
 * Warm, creamy luxury palette with soft diffused lighting
 */

export const tokens = {
  // ============================================
  // COLOR TOKENS - Warm Luxury Palette
  // ============================================
  colors: {
    // Primary palette - BLONDIES-inspired warm tones
    blush: '#F5E6E0',        // Soft blush background
    peach: '#FAE5E0',        // Peachy highlights
    cream: '#FDFBF9',         // Main background - warm white
    rose: '#D4A89A',         // Accent rose
    coral: '#E8B4A8',        // Primary accent coral

    // Text hierarchy - Warm neutrals
    charcoal: '#2D2D2D',     // Primary text - warm black
    warmGray: '#6B6B6B',     // Secondary text
    lightGray: '#9B9B9B',    // Tertiary text
    softGray: '#B5B0AB',      // Muted text

    // Semantic colors
    primary: '#E8B4A8',
    'primary-dark': '#D4A89A',
    secondary: '#D4A89A',
    accent: '#2D2D2D',
    success: '#7BA889',
    warning: '#E8C4A8',
    error: '#C88B8B',

    // Surfaces - Layered warmth
    surface: '#FFFFFF',
    surfaceWarm: '#FFFCF9',  // Warm surface
    muted: '#F8F6F4',        // Muted background
    mutedWarm: '#F5F0EB',    // BLONDIES cream tone
    overlay: 'rgba(45, 45, 45, 0.05)',
    border: '#E8E4E0',       // Soft warm border
    borderLight: '#F0EBE7',   // Lighter border

    // Transparency variants
    primaryAlpha: (opacity: number) => `rgba(232, 180, 168, ${opacity})`,
    charcoalAlpha: (opacity: number) => `rgba(45, 45, 45, ${opacity})`,
    creamAlpha: (opacity: number) => `rgba(253, 251, 249, ${opacity})`,
  },

  // ============================================
  // TYPOGRAPHY TOKENS
  // ============================================
  typography: {
    fontFamily: {
      serif: "'Cormorant Garamond', Georgia, serif",
      sans: "'Inter', system-ui, sans-serif",
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
      '6xl': '3.75rem',  // 60px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
    },
  },

  // ============================================
  // SPACING TOKENS
  // ============================================
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    14: '3.5rem',   // 56px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
    28: '7rem',     // 112px
    32: '8rem',     // 128px
  },

  // ============================================
  // BORDER RADIUS TOKENS
  // ============================================
  borderRadius: {
    none: '0',
    sm: '6px',
    DEFAULT: '8px',
    md: '10px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    full: '9999px',
  },

  // ============================================
  // SHADOW TOKENS - Warm & Soft
  // ============================================
  shadows: {
    none: 'none',
    // Base shadows - warm undertone
    sm: '0 1px 2px rgba(45, 45, 45, 0.04)',
    DEFAULT: '0 4px 20px rgba(45, 45, 45, 0.06)',
    md: '0 6px 24px rgba(45, 45, 45, 0.08)',
    lg: '0 8px 30px rgba(45, 45, 45, 0.1)',
    xl: '0 12px 40px rgba(45, 45, 45, 0.12)',
    // Warm shadows - coral/rose tint
    warm: '0 4px 20px rgba(212, 168, 154, 0.12)',
    'warm-md': '0 6px 24px rgba(232, 180, 168, 0.15)',
    'warm-lg': '0 8px 30px rgba(212, 168, 154, 0.18)',
    // Soft ambient - diffused lighting effect
    ambient: '0 2px 16px rgba(45, 45, 45, 0.05)',
    ambientWarm: '0 4px 20px rgba(232, 180, 168, 0.1)',
    // Glow effects - for premium elements
    glow: '0 0 30px rgba(232, 180, 168, 0.2)',
    glowStrong: '0 0 50px rgba(232, 180, 168, 0.3)',
    glowSoft: '0 0 20px rgba(232, 180, 168, 0.1)',
    // Inner glow - for pressed states
    innerWarm: 'inset 0 2px 8px rgba(232, 180, 168, 0.15)',
    innerSoft: 'inset 0 1px 4px rgba(45, 45, 45, 0.04)',
  },

  // ============================================
  // BLUR TOKENS - For glass effects
  // ============================================
  blur: {
    none: '0',
    sm: '4px',
    DEFAULT: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '40px',
  },

  // ============================================
  // GLASS EFFECT TOKENS
  // ============================================
  glass: {
    // Light glass - for cards on light backgrounds
    light: {
      bg: 'rgba(255, 255, 255, 0.6)',
      border: 'rgba(232, 228, 224, 0.5)',
      backdrop: 'blur(12px)',
    },
    // Medium glass - for modals, dropdowns
    medium: {
      bg: 'rgba(255, 255, 255, 0.75)',
      border: 'rgba(232, 228, 224, 0.6)',
      backdrop: 'blur(16px)',
    },
    // Strong glass - for navigation, headers
    strong: {
      bg: 'rgba(253, 251, 249, 0.85)',
      border: 'rgba(232, 228, 224, 0.7)',
      backdrop: 'blur(20px)',
    },
  },

  // ============================================
  // TRANSITION TOKENS
  // ============================================
  transitions: {
    fast: '150ms ease',
    DEFAULT: '200ms ease',
    slow: '300ms ease',
    slower: '400ms ease',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // ============================================
  // ANIMATION TOKENS
  // ============================================
  animations: {
    fadeIn: 'fadeIn 0.3s ease-out',
    slideUp: 'slideUp 0.3s ease-out',
    scaleIn: 'scaleIn 0.2s ease-out',
  },

  // ============================================
  // Z-INDEX TOKENS
  // ============================================
  zIndex: {
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
  },
};

// CSS Variable generator for inline styles
export const toCSSVariables = (prefix = '--nilin') => {
  const vars: Record<string, string> = {};

  // Colors
  Object.entries(tokens.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      vars[`${prefix}-color-${key}`] = value;
    }
  });

  // Typography
  Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
    vars[`${prefix}-text-${key}`] = value;
  });

  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    vars[`${prefix}-space-${key}`] = value;
  });

  // Border Radius
  Object.entries(tokens.borderRadius).forEach(([key, value]) => {
    vars[`${prefix}-radius-${key}`] = value;
  });

  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    vars[`${prefix}-shadow-${key}`] = value;
  });

  return vars;
};

export default tokens;
