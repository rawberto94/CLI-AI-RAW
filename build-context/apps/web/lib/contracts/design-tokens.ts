/**
 * Design tokens for contract components
 * Consistent styling values across the application
 */

// Colors
export const colors = {
  primary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  }
}

// Status colors
export const statusColors = {
  uploaded: colors.primary[500],
  processing: colors.primary[400],
  completed: colors.success[500],
  failed: colors.danger[500],
  pending: colors.neutral[400],
}

// Risk level colors
export const riskColors = {
  low: colors.success[500],
  medium: colors.warning[500],
  high: colors.danger[500],
}

// Spacing scale
export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
  '4xl': '6rem',    // 96px
}

// Border radius
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
}

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
}

// Typography
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  }
}

// Breakpoints for responsive design
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

// Z-index scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
}

// Animation durations
export const duration = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
}

// Animation easing
export const easing = {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
}

// Component-specific tokens
export const components = {
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    shadow: shadows.md,
    hoverShadow: shadows.lg,
  },
  button: {
    paddingX: spacing.lg,
    paddingY: spacing.sm,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  input: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.sm,
    borderWidth: '1px',
  },
  modal: {
    borderRadius: borderRadius.xl,
    shadow: shadows['2xl'],
    backdropBlur: '8px',
  },
}

// Contract-specific design tokens
export const contractTokens = {
  card: {
    minHeight: '200px',
    maxWidth: '400px',
    hoverTransform: 'translateY(-2px)',
  },
  status: {
    badgeSize: '8px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  metrics: {
    iconSize: '24px',
    valueSize: typography.fontSize['2xl'],
    labelSize: typography.fontSize.sm,
  },
  upload: {
    dropZoneHeight: '200px',
    borderStyle: 'dashed',
    borderWidth: '2px',
    activeBorderColor: colors.primary[500],
  },
  progress: {
    height: '8px',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
  },
}

// Export utility functions
export const getStatusColor = (status: string) => {
  return statusColors[status as keyof typeof statusColors] || colors.gray[400]
}

export const getRiskColor = (risk: string) => {
  return riskColors[risk as keyof typeof riskColors] || colors.gray[400]
}

export const getContrastColor = (backgroundColor: string) => {
  // Simple contrast calculation - in production, use a proper contrast library
  const isDark = backgroundColor.includes('800') || backgroundColor.includes('900')
  return isDark ? colors.gray[50] : colors.gray[900]
}
