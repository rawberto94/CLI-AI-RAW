/**
 * Workflow Component UI Enhancements
 * Quick wins for better usability, accessibility, and visual polish
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================================================
// STANDARDIZED COLOR PALETTE
// ============================================================================

/**
 * Standardized workflow type colors for visual consistency
 * All colors meet WCAG AA contrast requirements
 */
export const WORKFLOW_COLORS = {
  // Standard workflows
  approval: 'from-violet-500 to-purple-600',
  review: 'from-purple-500 to-fuchsia-600',
  
  // Process types
  quick: 'from-green-500 to-emerald-600',
  comprehensive: 'from-purple-600 to-violet-700',
  
  // Specialized workflows
  renewal: 'from-amber-500 to-orange-600',
  amendment: 'from-cyan-500 to-violet-600',
  highValue: 'from-rose-500 to-pink-600',
  
  // Compliance workflows
  compliance: 'from-indigo-500 to-violet-600',
  gdpr: 'from-teal-500 to-emerald-600',
  sox: 'from-indigo-600 to-purple-700',
  
  // Status colors
  active: 'from-green-500 to-emerald-600',
  archived: 'from-slate-400 to-slate-600',
  draft: 'from-amber-400 to-orange-500',
} as const;

/**
 * Dark mode compatible workflow colors
 */
export const WORKFLOW_COLORS_DARK = {
  approval: 'dark:from-violet-400 dark:to-purple-500',
  review: 'dark:from-purple-400 dark:to-fuchsia-500',
  quick: 'dark:from-green-400 dark:to-emerald-500',
  comprehensive: 'dark:from-purple-500 dark:to-violet-600',
  renewal: 'dark:from-amber-400 dark:to-orange-500',
  amendment: 'dark:from-cyan-400 dark:to-violet-500',
  highValue: 'dark:from-rose-400 dark:to-pink-500',
  compliance: 'dark:from-indigo-400 dark:to-violet-500',
  gdpr: 'dark:from-teal-400 dark:to-emerald-500',
  sox: 'dark:from-indigo-500 dark:to-purple-600',
  active: 'dark:from-green-400 dark:to-emerald-500',
  archived: 'dark:from-slate-500 dark:to-slate-700',
  draft: 'dark:from-amber-500 dark:to-orange-600',
} as const;

// ============================================================================
// ENHANCED INTERACTION STYLES
// ============================================================================

/**
 * Standardized interactive element classes
 */
export const INTERACTIVE_CLASSES = {
  base: 'transition-all duration-200 ease-out',
  hover: 'hover:scale-[1.02] hover:shadow-lg',
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  active: 'active:scale-[0.98]',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none',
} as const;

/**
 * Get all interactive classes for an element
 */
export function getInteractiveClasses(options: {
  includeHover?: boolean;
  includeFocus?: boolean;
  includeActive?: boolean;
  includeDisabled?: boolean;
} = {}) {
  const {
    includeHover = true,
    includeFocus = true,
    includeActive = true,
    includeDisabled = true,
  } = options;

  return twMerge(
    INTERACTIVE_CLASSES.base,
    includeHover && INTERACTIVE_CLASSES.hover,
    includeFocus && INTERACTIVE_CLASSES.focus,
    includeActive && INTERACTIVE_CLASSES.active,
    includeDisabled && INTERACTIVE_CLASSES.disabled,
  );
}

// ============================================================================
// DARK MODE UTILITIES
// ============================================================================

/**
 * Enhanced dark mode class generator
 */
export function darkMode(lightClasses: string, darkClasses: string) {
  return `${lightClasses} ${darkClasses}`;
}

/**
 * Card with dark mode support
 */
export const CARD_CLASSES = {
  base: 'rounded-lg border shadow-sm',
  light: 'bg-white border-slate-200',
  dark: 'dark:bg-slate-900 dark:border-slate-700 dark:shadow-slate-900/50',
  hover: 'hover:shadow-md dark:hover:shadow-slate-900/70',
} as const;

export function getCardClasses(includeHover = false) {
  return twMerge(
    CARD_CLASSES.base,
    CARD_CLASSES.light,
    CARD_CLASSES.dark,
    includeHover && CARD_CLASSES.hover,
  );
}

// ============================================================================
// STATUS BADGE COLORS (WCAG AA COMPLIANT)
// ============================================================================

/**
 * Status badge colors with proper contrast for light and dark modes
 */
export const STATUS_BADGE_COLORS = {
  success: {
    light: 'bg-green-100 text-green-800 border-green-300',
    dark: 'dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  },
  warning: {
    light: 'bg-amber-100 text-amber-900 border-amber-300',
    dark: 'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  },
  error: {
    light: 'bg-red-100 text-red-800 border-red-300',
    dark: 'dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  },
  info: {
    light: 'bg-violet-100 text-violet-800 border-violet-300',
    dark: 'dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
  },
  neutral: {
    light: 'bg-slate-100 text-slate-800 border-slate-300',
    dark: 'dark:bg-slate-800/30 dark:text-slate-300 dark:border-slate-600',
  },
} as const;

export function getStatusBadgeClasses(
  status: keyof typeof STATUS_BADGE_COLORS
) {
  const colors = STATUS_BADGE_COLORS[status];
  return `${colors.light} ${colors.dark} px-2.5 py-1 rounded-md text-xs font-medium border`;
}

// ============================================================================
// TOUCH-FRIENDLY SIZING
// ============================================================================

/**
 * Minimum touch target sizes (Apple/Android guidelines)
 */
export const TOUCH_TARGET = {
  min: 'min-h-[44px] min-w-[44px]',
  comfortable: 'min-h-[48px] min-w-[48px]',
  spacious: 'min-h-[56px] min-w-[56px]',
} as const;

/**
 * Apply touch-friendly sizing on mobile
 */
export function getTouchFriendlyClasses(
  size: keyof typeof TOUCH_TARGET = 'min'
) {
  return `md:min-h-auto md:min-w-auto ${TOUCH_TARGET[size]}`;
}

// ============================================================================
// ANIMATION UTILITIES
// ============================================================================

/**
 * Respect prefers-reduced-motion
 */
export function getAnimationClasses(
  normalAnimation: string,
  reducedAnimation: string = 'transition-none'
) {
  return `${normalAnimation} motion-reduce:${reducedAnimation}`;
}

/**
 * Staggered animation variants for Framer Motion
 */
export const STAGGER_VARIANTS = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24,
      },
    },
  },
} as const;

// ============================================================================
// LOADING STATE STYLES
// ============================================================================

/**
 * Skeleton loader classes
 */
export const SKELETON_CLASSES = {
  base: 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded',
  text: 'h-4 w-full',
  heading: 'h-6 w-3/4',
  avatar: 'rounded-full w-10 h-10',
  card: 'h-32 w-full',
} as const;

export function getSkeletonClasses(
  type: keyof typeof SKELETON_CLASSES = 'base'
) {
  return `${SKELETON_CLASSES.base} ${type !== 'base' ? SKELETON_CLASSES[type] : ''}`;
}

// ============================================================================
// ACCESSIBILITY HELPERS
// ============================================================================

/**
 * Screen reader only text
 */
export const SR_ONLY = 'sr-only';

/**
 * Focus visible on keyboard navigation only
 */
export const FOCUS_VISIBLE = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

/**
 * Skip to content link styles
 */
export const SKIP_LINK = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg';

/**
 * ARIA live region classes
 */
export const LIVE_REGION = 'sr-only [&>*]:not-sr-only';

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================

/**
 * Container responsive padding
 */
export const CONTAINER_PADDING = 'px-4 sm:px-6 lg:px-8';

/**
 * Responsive text sizing
 */
export const RESPONSIVE_TEXT = {
  xs: 'text-xs sm:text-sm',
  sm: 'text-sm sm:text-base',
  base: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl',
  xl: 'text-xl sm:text-2xl',
  '2xl': 'text-2xl sm:text-3xl',
  '3xl': 'text-3xl sm:text-4xl',
} as const;

// ============================================================================
// DESIGN TOKENS
// ============================================================================

/**
 * Consistent spacing scale
 */
export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

/**
 * Border radius scale
 */
export const RADIUS = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const;

/**
 * Shadow scale
 */
export const SHADOW = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
  inner: 'shadow-inner',
  none: 'shadow-none',
} as const;

// ============================================================================
// UTILITY FUNCTION
// ============================================================================

/**
 * Combine class names with tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// KEYBOARD SHORTCUTS METADATA
// ============================================================================

/**
 * Workflow keyboard shortcuts
 */
export const WORKFLOW_SHORTCUTS = {
  'Shift + N': 'Add new step',
  'Delete': 'Delete selected step',
  'Ctrl + D': 'Duplicate step',
  'Ctrl + Z': 'Undo',
  'Ctrl + Y': 'Redo',
  'ArrowUp/Down/Left/Right': 'Navigate between steps',
  'Tab': 'Focus next element',
  'Shift + Tab': 'Focus previous element',
  'Enter': 'Edit selected step',
  'Escape': 'Cancel editing',
  'Ctrl + S': 'Save workflow',
  'Ctrl + F': 'Search workflows',
} as const;

/**
 * Format keyboard shortcut for display
 */
export function formatKeyboardShortcut(shortcut: string): string {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return shortcut.replace(/Ctrl/g, isMac ? '⌘' : 'Ctrl');
}
