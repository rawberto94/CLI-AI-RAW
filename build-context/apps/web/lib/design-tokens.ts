/**
 * Design Tokens - Professional & Minimalistic Design System
 * 
 * A cohesive design language for a clean, modern, yet comprehensive UI.
 * Inspired by Linear, Stripe, and Vercel design patterns.
 */

// Color Palette - Sophisticated and muted
export const colors = {
  // Primary - Deep indigo
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  
  // Neutral - Slate grays
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
    950: '#020617',
  },
  
  // Success - Emerald
  success: {
    light: '#d1fae5',
    main: '#10b981',
    dark: '#059669',
  },
  
  // Warning - Amber
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#d97706',
  },
  
  // Danger - Rose
  danger: {
    light: '#ffe4e6',
    main: '#f43f5e',
    dark: '#e11d48',
  },
  
  // Info - Sky
  info: {
    light: '#e0f2fe',
    main: '#0ea5e9',
    dark: '#0284c7',
  },
} as const;

// Spacing - 4px base grid
export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
} as const;

// Typography
export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'JetBrains Mono, "SF Mono", Monaco, "Cascadia Code", Consolas, monospace',
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.05em',
  },
} as const;

// Shadows - Subtle, layered depth
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Colored glow shadows
  primary: '0 0 20px -5px rgba(99, 102, 241, 0.4)',
  success: '0 0 20px -5px rgba(16, 185, 129, 0.4)',
  warning: '0 0 20px -5px rgba(245, 158, 11, 0.4)',
  danger: '0 0 20px -5px rgba(244, 63, 94, 0.4)',
} as const;

// Border Radius
export const radius = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const;

// Transitions
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  spring: '400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// Z-index scale
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 1,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
  tooltip: 70,
} as const;

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Status colors with semantic meaning
export const statusColors = {
  success: {
    bg: 'bg-emerald-50',
    bgDark: 'bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-500',
    gradient: 'from-emerald-500 to-green-600',
  },
  warning: {
    bg: 'bg-amber-50',
    bgDark: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    gradient: 'from-amber-500 to-orange-600',
  },
  danger: {
    bg: 'bg-rose-50',
    bgDark: 'bg-rose-100',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: 'text-rose-500',
    gradient: 'from-rose-500 to-red-600',
  },
  info: {
    bg: 'bg-sky-50',
    bgDark: 'bg-sky-100',
    text: 'text-sky-700',
    border: 'border-sky-200',
    icon: 'text-sky-500',
    gradient: 'from-sky-500 to-blue-600',
  },
  neutral: {
    bg: 'bg-slate-50',
    bgDark: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: 'text-slate-500',
    gradient: 'from-slate-500 to-gray-600',
  },
} as const;

// Component-specific tokens
export const components = {
  card: {
    base: 'bg-white border border-slate-200/60 rounded-xl shadow-sm',
    hover: 'hover:shadow-md hover:border-slate-300/60 transition-all duration-200',
    interactive: 'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
  },
  
  badge: {
    sm: 'px-2 py-0.5 text-xs font-medium rounded-full',
    md: 'px-2.5 py-1 text-sm font-medium rounded-full',
    lg: 'px-3 py-1.5 text-sm font-semibold rounded-full',
  },
  
  button: {
    base: 'inline-flex items-center justify-center font-medium transition-all duration-200',
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  },
  
  input: {
    base: 'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400',
    focus: 'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500',
    error: 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500',
  },
} as const;

// Utility function to get risk color based on score
export function getRiskColor(score: number) {
  if (score < 30) return statusColors.success;
  if (score < 60) return statusColors.warning;
  return statusColors.danger;
}

// Utility function to get compliance color based on score
export function getComplianceColor(score: number) {
  if (score >= 90) return statusColors.success;
  if (score >= 70) return statusColors.warning;
  return statusColors.danger;
}

// Utility to format currency
export function formatCurrency(value: number, currency = 'CHF'): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Utility to format large numbers
export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

// Utility to format dates
export function formatDate(date: string | Date, style: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (style === 'long') {
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

// Export a default theme object
const designTokens = {
  colors,
  spacing,
  typography,
  shadows,
  radius,
  transitions,
  zIndex,
  breakpoints,
  statusColors,
  components,
  utils: {
    getRiskColor,
    getComplianceColor,
    formatCurrency,
    formatNumber,
    formatDate,
  },
};

export default designTokens;
