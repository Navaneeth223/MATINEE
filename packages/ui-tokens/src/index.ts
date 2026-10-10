export const COLORS = {
  surface: {
    bg: '#0d0b0e',
    card: '#1a1621',
    overlay: '#251f2e',
  },
  accent: {
    primary: '#c8956c',
    secondary: '#8b5e3c',
    muted: '#5c3d2e',
  },
  text: {
    primary: '#f2ebe4',
    secondary: '#a89880',
    muted: '#6b5d52',
  },
  status: {
    success: '#4caf82',
    warning: '#e8a838',
    error: '#d95f5f',
    info: '#5b8dd9',
  },
} as const;

export const TYPOGRAPHY = {
  fontFamilies: {
    sans: "'Noto Sans', 'Noto Sans Thai', 'Noto Sans Malayalam', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  scale: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const SPACING = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  12: '3rem',
  16: '4rem',
  24: '6rem',
} as const;
