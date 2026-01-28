/**
 * Design System Enhancements
 * 
 * Professional UI polish components and utilities for a consistent,
 * clean, and easy-to-use interface.
 */

'use client'

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

// ============================================================================
// PROFESSIONAL CARD VARIANTS
// ============================================================================

const cardVariants = cva(
  "rounded-xl border transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white border-slate-200 shadow-sm",
        elevated: "bg-white border-slate-200/50 shadow-md hover:shadow-lg",
        subtle: "bg-slate-50/50 border-slate-100",
        ghost: "bg-transparent border-transparent",
        glass: "bg-white/80 backdrop-blur-xl border-white/50 shadow-lg",
        gradient: "bg-gradient-to-br from-white via-slate-50/50 to-white border-slate-200",
      },
      padding: {
        none: "p-0",
        sm: "p-3 sm:p-4",
        md: "p-4 sm:p-5",
        lg: "p-5 sm:p-6",
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-0.5 hover:shadow-md",
        glow: "hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]",
        border: "hover:border-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
      hover: "none",
    },
  }
)

interface ProfessionalCardProps extends VariantProps<typeof cardVariants> {
  children: React.ReactNode
  animate?: boolean
  className?: string
}

export const ProfessionalCard = memo(function ProfessionalCard({
  children,
  variant,
  padding,
  hover,
  animate = true,
  className,
}: ProfessionalCardProps) {
  if (animate) {
    return (
      <motion.div
        className={cn(cardVariants({ variant, padding, hover }), className)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    )
  }
  
  return (
    <div className={cn(cardVariants({ variant, padding, hover }), className)}>
      {children}
    </div>
  )
})

// ============================================================================
// STATUS INDICATOR
// ============================================================================

const statusConfig = {
  active: { color: 'violet', label: 'Active', pulse: true },
  pending: { color: 'amber', label: 'Pending', pulse: false },
  expired: { color: 'red', label: 'Expired', pulse: false },
  draft: { color: 'slate', label: 'Draft', pulse: false },
  processing: { color: 'blue', label: 'Processing', pulse: true },
  completed: { color: 'green', label: 'Completed', pulse: false },
  cancelled: { color: 'slate', label: 'Cancelled', pulse: false },
  archived: { color: 'slate', label: 'Archived', pulse: false },
  expiring: { color: 'orange', label: 'Expiring Soon', pulse: true },
} as const

interface StatusIndicatorProps {
  status: keyof typeof statusConfig | string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export const StatusIndicator = memo(function StatusIndicator({
  status,
  size = 'md',
  showLabel = true,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || { 
    color: 'slate', 
    label: status, 
    pulse: false 
  }
  
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }
  
  const colorClasses = {
    emerald: 'bg-violet-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    slate: 'bg-slate-400',
    blue: 'bg-violet-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  }
  
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex">
        <span className={cn(
          "rounded-full",
          sizeClasses[size],
          colorClasses[config.color as keyof typeof colorClasses] || 'bg-slate-400'
        )} />
        {config.pulse && (
          <span className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-75",
            colorClasses[config.color as keyof typeof colorClasses] || 'bg-slate-400'
          )} />
        )}
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 capitalize">
          {config.label}
        </span>
      )}
    </span>
  )
})

// ============================================================================
// SECTION HEADER
// ============================================================================

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export const SectionHeader = memo(function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 p-2 rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
})

// ============================================================================
// METRIC DISPLAY
// ============================================================================

interface MetricDisplayProps {
  label: string
  value: string | number
  subValue?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const MetricDisplay = memo(function MetricDisplay({
  label,
  value,
  subValue,
  icon,
  trend,
  trendValue,
  color = 'default',
  size = 'md',
  className,
}: MetricDisplayProps) {
  const colorClasses = {
    default: 'text-slate-900',
    success: 'text-violet-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    info: 'text-violet-600',
  }
  
  const bgColorClasses = {
    default: 'bg-slate-100',
    success: 'bg-violet-100',
    warning: 'bg-amber-100',
    error: 'bg-red-100',
    info: 'bg-violet-100',
  }
  
  const iconColorClasses = {
    default: 'text-slate-600',
    success: 'text-violet-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    info: 'text-violet-600',
  }
  
  const sizeClasses = {
    sm: { value: 'text-lg font-semibold', label: 'text-[10px]' },
    md: { value: 'text-xl sm:text-2xl font-bold', label: 'text-xs' },
    lg: { value: 'text-2xl sm:text-3xl font-bold', label: 'text-sm' },
  }
  
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon && (
          <div className={cn("p-1.5 rounded-lg", bgColorClasses[color])}>
            <span className={iconColorClasses[color]}>{icon}</span>
          </div>
        )}
        <span className={cn(
          "font-semibold text-slate-500 uppercase tracking-wider",
          sizeClasses[size].label
        )}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn(sizeClasses[size].value, colorClasses[color])}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-slate-500">{subValue}</span>
        )}
        {trend && trendValue && (
          <span className={cn(
            "text-xs font-medium",
            trend === 'up' ? 'text-violet-600' : 
            trend === 'down' ? 'text-red-600' : 'text-slate-500'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
    </div>
  )
})

// ============================================================================
// DIVIDER
// ============================================================================

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  className?: string
}

export const Divider = memo(function Divider({
  orientation = 'horizontal',
  label,
  className,
}: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={cn("w-px bg-slate-200 self-stretch", className)} />
  }
  
  if (label) {
    return (
      <div className={cn("flex items-center gap-3 my-4", className)}>
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    )
  }
  
  return <div className={cn("h-px bg-slate-200 my-4", className)} />
})

// ============================================================================
// LOADING SHIMMER
// ============================================================================

interface ShimmerProps {
  width?: string | number
  height?: string | number
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

export const Shimmer = memo(function Shimmer({
  width,
  height,
  rounded = 'md',
  className,
}: ShimmerProps) {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }
  
  return (
    <div
      className={cn(
        "bg-slate-200 animate-pulse relative overflow-hidden",
        roundedClasses[rounded],
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
})

// ============================================================================
// BADGE VARIANTS
// ============================================================================

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium rounded-full border transition-colors",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700 border-slate-200",
        primary: "bg-purple-100 text-purple-700 border-indigo-200",
        success: "bg-violet-100 text-violet-700 border-violet-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        error: "bg-red-100 text-red-700 border-red-200",
        info: "bg-violet-100 text-violet-700 border-violet-200",
        outline: "bg-transparent text-slate-600 border-slate-300",
      },
      size: {
        xs: "text-[10px] px-1.5 py-0.5",
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
)

interface ProfessionalBadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export const ProfessionalBadge = memo(function ProfessionalBadge({
  children,
  icon,
  variant,
  size,
  className,
}: ProfessionalBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {icon}
      {children}
    </span>
  )
})

// ============================================================================
// ANIMATIONS
// ============================================================================

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.15 },
}

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.2 },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}
