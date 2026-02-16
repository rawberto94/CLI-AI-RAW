// AI Intelligence Platform Theme Configuration

export const aiTheme = {
  // Brand Colors — Violet primary
  colors: {
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
    },
    secondary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
    },
    accent: {
      50: '#f5f3ff',
      100: '#ede9fe',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
  },

  // Gradient Patterns
  gradients: {
    primary: 'bg-gradient-to-r from-violet-500 to-purple-600',
    secondary: 'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600',
    accent: 'bg-gradient-to-br from-violet-50 to-purple-50',
    success: 'bg-gradient-to-r from-green-50 to-violet-50',
    warning: 'bg-gradient-to-r from-yellow-50 to-orange-50',
    background: 'bg-gradient-to-br from-violet-50 via-white to-purple-50',
  },

  // Component Styles
  components: {
    card: {
      base: 'bg-white border border-slate-200 rounded-lg shadow-sm',
      hover: 'hover:shadow-xl transition-all duration-300 border-2 hover:border-violet-300',
      gradient: 'bg-gradient-to-br from-white to-slate-50',
    },
    button: {
      primary: 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white',
      secondary: 'bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white',
      outline: 'border-2 border-violet-500 text-violet-600 hover:bg-violet-50',
    },
    icon: {
      container: 'w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center',
      small: 'w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center',
      large: 'w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center',
    },
    status: {
      online: 'flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200',
      processing: 'flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-lg border border-violet-200',
      warning: 'flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200',
      error: 'flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200',
    },
  },

  // Animation Classes
  animations: {
    fadeIn: 'animate-fade-in',
    slideIn: 'animate-slide-in',
    bounceIn: 'animate-bounce-in',
    pulse: 'animate-pulse',
    spin: 'animate-spin-slow',
  },

  // Typography
  typography: {
    heading: {
      h1: 'text-3xl font-bold text-slate-900',
      h2: 'text-2xl font-bold text-slate-900',
      h3: 'text-xl font-bold text-slate-900',
      h4: 'text-lg font-semibold text-slate-900',
    },
    body: {
      large: 'text-lg text-slate-700',
      base: 'text-base text-slate-700',
      small: 'text-sm text-slate-600',
      xs: 'text-xs text-slate-500',
    },
  },

  // Spacing
  spacing: {
    section: 'space-y-6',
    card: 'p-6',
    cardLarge: 'p-8',
    cardSmall: 'p-4',
  },
};

// Utility functions for consistent styling
export const getGradientClass = (type: keyof typeof aiTheme.gradients) => {
  return aiTheme.gradients[type];
};

export const getButtonClass = (variant: keyof typeof aiTheme.components.button) => {
  return aiTheme.components.button[variant];
};

export const getIconContainerClass = (size: keyof typeof aiTheme.components.icon = 'container') => {
  return aiTheme.components.icon[size];
};

export const getStatusClass = (status: keyof typeof aiTheme.components.status) => {
  return aiTheme.components.status[status];
};

export const getCardClass = (variant: keyof typeof aiTheme.components.card = 'base') => {
  return aiTheme.components.card[variant];
};

// Common component combinations
export const aiStyles = {
  // Executive header card
  executiveHeader: `${aiTheme.gradients.secondary} text-white overflow-hidden relative`,
  
  // Metric card
  metricCard: `${aiTheme.components.card.gradient} ${aiTheme.components.card.hover} ${aiTheme.spacing.card}`,
  
  // AI status indicator
  aiOnline: `${aiTheme.components.status.online} text-green-700 font-medium`,
  
  // Demo background
  demoBackground: aiTheme.gradients.background,
  
  // Interactive card
  interactiveCard: `${aiTheme.components.card.base} ${aiTheme.components.card.hover} cursor-pointer group`,
  
  // Primary action button
  primaryAction: `${aiTheme.components.button.primary} px-6 py-3 rounded-lg font-semibold transition-all duration-200`,
  
  // Secondary action button
  secondaryAction: `${aiTheme.components.button.secondary} px-6 py-3 rounded-lg font-semibold transition-all duration-200`,
};

export default aiTheme;