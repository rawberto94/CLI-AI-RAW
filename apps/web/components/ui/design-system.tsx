/**
 * Unified Design System
 * Consistent styling, theming, and components across the application
 */

import React from 'react'
import { cn } from '@/lib/utils'

// Color Palette
export const colors = {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  secondary: {
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
  error: {
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
  ai: {
    gradient: 'bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600',
    gradientHover: 'hover:from-violet-700 hover:via-purple-700 hover:to-purple-700',
    text: 'text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600',
    border: 'border-gradient-to-r from-violet-600 via-purple-600 to-purple-600',
  }
}

// Typography Scale
export const typography = {
  h1: 'text-4xl font-bold tracking-tight lg:text-5xl',
  h2: 'text-3xl font-semibold tracking-tight',
  h3: 'text-2xl font-semibold tracking-tight',
  h4: 'text-xl font-semibold tracking-tight',
  h5: 'text-lg font-semibold',
  h6: 'text-base font-semibold',
  body: 'text-base',
  small: 'text-sm',
  xs: 'text-xs',
  lead: 'text-xl text-muted-foreground',
  large: 'text-lg font-semibold',
  muted: 'text-sm text-muted-foreground',
}

// Spacing Scale
export const spacing = {
  xs: 'p-2',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-12',
  '2xl': 'p-16',
}

// Component Variants
export const variants = {
  card: {
    default: 'rounded-lg border bg-card text-card-foreground shadow-sm',
    elevated: 'rounded-lg border bg-card text-card-foreground shadow-lg',
    interactive: 'rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer',
    ai: 'rounded-lg border bg-gradient-to-br from-violet-50 to-purple-50 text-card-foreground shadow-sm border-violet-200',
  },
  button: {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    success: 'bg-green-600 text-white hover:bg-green-700',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
    error: 'bg-red-600 text-white hover:bg-red-700',
    ai: 'bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 text-white hover:from-violet-700 hover:via-purple-700 hover:to-purple-700',
  },
  badge: {
    default: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-violet-100 text-violet-800',
    ai: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800',
  }
}

// Status Colors
export const statusColors = {
  success: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  info: 'text-violet-600 bg-violet-50 border-violet-200',
  processing: 'text-purple-600 bg-purple-50 border-purple-200',
}

// Animation Classes
export const animations = {
  fadeIn: 'animate-in fade-in-0 duration-200',
  slideIn: 'animate-in slide-in-from-bottom-4 duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
  bounce: 'animate-bounce',
}

// Layout Components
export const PageHeader: React.FC<{
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}> = ({ title, description, children, className }) => (
  <div className={cn('flex items-center justify-between space-y-2', className)}>
    <div>
      <h1 className={typography.h1}>{title}</h1>
      {description && (
        <p className={typography.lead}>{description}</p>
      )}
    </div>
    {children && (
      <div className="flex items-center space-x-2">
        {children}
      </div>
    )}
  </div>
)

export const Section: React.FC<{
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}> = ({ title, description, children, className }) => (
  <section className={cn('space-y-6', className)}>
    {(title || description) && (
      <div>
        {title && <h2 className={typography.h2}>{title}</h2>}
        {description && <p className={typography.muted}>{description}</p>}
      </div>
    )}
    {children}
  </section>
)

export const Grid: React.FC<{
  cols?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}> = ({ cols = 1, gap = 'md', children, className }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-12',
  }
  
  const gridGap = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  }

  return (
    <div className={cn('grid', gridCols[cols], gridGap[gap], className)}>
      {children}
    </div>
  )
}

export const StatusIndicator: React.FC<{
  status: 'success' | 'warning' | 'error' | 'info' | 'processing'
  children: React.ReactNode
  className?: string
}> = ({ status, children, className }) => (
  <div className={cn(
    'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
    statusColors[status],
    className
  )}>
    {children}
  </div>
)

export const AIBadge: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <span className={cn(
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800 border border-violet-200',
    className
  )}>
    {children}
  </span>
)

export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ size = 'md', className }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-violet-600', sizes[size], className)} />
  )
}

export const EmptyState: React.FC<{
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}> = ({ title, description, action, icon, className }) => (
  <div className={cn('text-center py-12', className)}>
    {icon && (
      <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
        {icon}
      </div>
    )}
    <h3 className={cn(typography.h4, 'text-gray-900 mb-2')}>{title}</h3>
    {description && (
      <p className={cn(typography.muted, 'mb-6')}>{description}</p>
    )}
    {action}
  </div>
)

// Utility Functions
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
    case 'active':
      return statusColors.success
    case 'processing':
    case 'running':
    case 'pending':
      return statusColors.processing
    case 'failed':
    case 'error':
      return statusColors.error
    case 'warning':
      return statusColors.warning
    default:
      return statusColors.info
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`
}