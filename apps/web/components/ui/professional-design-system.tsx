/**
 * Professional UI Design System
 * 
 * Next-level UI components for a polished, professional experience
 */

'use client';

import React, { forwardRef, memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants, MotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  LucideIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
} from 'lucide-react';

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,
  
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  } as Variants,
  
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  } as Variants,
  
  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  } as Variants,
  
  fadeInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  } as Variants,
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  } as Variants,
  
  scaleUp: {
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.5 },
  } as Variants,
  
  slideInFromBottom: {
    initial: { opacity: 0, y: '100%' },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: '100%' },
  } as Variants,
  
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  } as Variants,
  
  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  } as Variants,
  
  pulse: {
    animate: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  } as Variants,
  
  shimmer: {
    animate: {
      x: ['-100%', '100%'],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      },
    },
  } as Variants,
};

// =============================================================================
// GLASS CARD
// =============================================================================

const glassCardVariants = cva(
  'relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-white/80 dark:bg-gray-900/80 border-white/20 dark:border-gray-700/50',
        subtle: 'bg-white/60 dark:bg-gray-900/60 border-white/10 dark:border-gray-800/30',
        elevated: 'bg-white/90 dark:bg-gray-900/90 border-white/30 shadow-xl shadow-black/5',
        gradient: 'bg-gradient-to-br from-white/80 to-white/60 dark:from-gray-900/80 dark:to-gray-800/60 border-white/20',
        accent: 'bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200/30',
      },
      hover: {
        none: '',
        lift: 'hover:shadow-lg hover:-translate-y-1',
        glow: 'hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-300/50',
        scale: 'hover:scale-[1.02]',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      hover: 'none',
      padding: 'md',
    },
  }
);

interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  glow?: boolean;
  glowColor?: string;
}

export const GlassCard = memo(forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, hover, padding, glow, glowColor = 'blue', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          glassCardVariants({ variant, hover, padding }),
          className
        )}
        {...props}
      >
        {glow && (
          <div
            className={cn(
              'absolute -inset-px rounded-2xl opacity-0 transition-opacity group-hover:opacity-100',
              `bg-gradient-to-r from-${glowColor}-500/20 via-${glowColor}-500/10 to-${glowColor}-500/20`
            )}
          />
        )}
        {children}
      </div>
    );
  }
));
GlassCard.displayName = 'GlassCard';

// =============================================================================
// ANIMATED CONTAINER
// =============================================================================

interface AnimatedContainerProps extends MotionProps {
  animation?: keyof typeof animations;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export const AnimatedContainer = memo(forwardRef<HTMLDivElement, AnimatedContainerProps>(
  ({ animation = 'fadeInUp', delay = 0, className, children, ...props }, ref) => {
    const animationVariants = animations[animation];
    
    return (
      <motion.div
        ref={ref}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={animationVariants}
        transition={{ duration: 0.3, delay, ease: 'easeOut' }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
));
AnimatedContainer.displayName = 'AnimatedContainer';

// =============================================================================
// STATUS PILL
// =============================================================================

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-3 py-1',
        lg: 'text-sm px-4 py-1.5',
      },
      animated: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      status: 'neutral',
      size: 'md',
      animated: false,
    },
  }
);

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  icon?: LucideIcon;
  pulse?: boolean;
}

export const StatusPill = memo(forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, size, icon: Icon, pulse, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(statusPillVariants({ status, size }), className)}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              status === 'success' && 'bg-emerald-400',
              status === 'warning' && 'bg-amber-400',
              status === 'error' && 'bg-red-400',
              status === 'info' && 'bg-blue-400',
              status === 'active' && 'bg-green-400',
              status === 'pending' && 'bg-yellow-400'
            )} />
            <span className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              status === 'success' && 'bg-emerald-500',
              status === 'warning' && 'bg-amber-500',
              status === 'error' && 'bg-red-500',
              status === 'info' && 'bg-blue-500',
              status === 'active' && 'bg-green-500',
              status === 'pending' && 'bg-yellow-500'
            )} />
          </span>
        )}
        {Icon && <Icon className="h-3 w-3" />}
        {children}
      </span>
    );
  }
));
StatusPill.displayName = 'StatusPill';

// =============================================================================
// METRIC CARD
// =============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
  className?: string;
}

export const MetricCard = memo<MetricCardProps>(({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  loading = false,
  className,
}) => {
  const iconColorClass = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    error: 'bg-red-100 text-red-600',
    info: 'bg-blue-100 text-blue-600',
  }[variant];

  const trendColorClass = {
    up: 'text-emerald-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    >
      {/* Background gradient effect */}
      <div className={cn(
        'absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100',
        variant === 'success' && 'bg-gradient-to-br from-emerald-50/50 to-transparent',
        variant === 'warning' && 'bg-gradient-to-br from-amber-50/50 to-transparent',
        variant === 'error' && 'bg-gradient-to-br from-red-50/50 to-transparent',
        variant === 'info' && 'bg-gradient-to-br from-blue-50/50 to-transparent'
      )} />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {value}
            </p>
          )}
          
          {(subtitle || trend) && (
            <div className="flex items-center gap-2">
              {trend && trendValue && (
                <span className={cn('flex items-center text-xs font-medium', trendColorClass[trend])}>
                  <TrendIcon className="mr-0.5 h-3 w-3" />
                  {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-gray-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        
        {Icon && (
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
            iconColorClass
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
});
MetricCard.displayName = 'MetricCard';

// =============================================================================
// PROFESSIONAL BUTTON
// =============================================================================

const professionalButtonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 focus-visible:ring-blue-500',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 focus-visible:ring-gray-500',
        outline: 'border-2 border-gray-300 bg-transparent hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 focus-visible:ring-gray-500',
        ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-gray-500',
        success: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-md shadow-emerald-500/25 hover:shadow-lg focus-visible:ring-emerald-500',
        danger: 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-md shadow-red-500/25 hover:shadow-lg focus-visible:ring-red-500',
        glass: 'bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30 focus-visible:ring-white/50',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-md',
        sm: 'h-8 px-3 text-sm rounded-lg',
        md: 'h-10 px-4 text-sm rounded-lg',
        lg: 'h-12 px-6 text-base rounded-xl',
        xl: 'h-14 px-8 text-lg rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-lg',
        'icon-lg': 'h-12 w-12 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ProfessionalButtonProps extends VariantProps<typeof professionalButtonVariants> {
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
  className?: string;
}

export const ProfessionalButton = memo(forwardRef<HTMLButtonElement, ProfessionalButtonProps>(
  ({ className, variant, size, loading, icon: Icon, iconPosition = 'left', children, disabled, onClick, type = 'button' }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={cn(professionalButtonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        onClick={onClick}
        type={type}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className="h-4 w-4" />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className="h-4 w-4" />}
          </>
        )}
      </motion.button>
    );
  }
));
ProfessionalButton.displayName = 'ProfessionalButton';

// =============================================================================
// SECTION DIVIDER
// =============================================================================

interface SectionDividerProps {
  label?: string;
  icon?: LucideIcon;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const SectionDivider = memo<SectionDividerProps>(({
  label,
  icon: Icon,
  className,
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <div className="h-4 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-700" />
        {label && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 [writing-mode:vertical-rl] rotate-180">
            {label}
          </span>
        )}
        <div className="flex-1 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-700" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
      {(label || Icon) && (
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </div>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
    </div>
  );
});
SectionDivider.displayName = 'SectionDivider';

// =============================================================================
// ANIMATED COUNTER
// =============================================================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: (value: number) => string;
}

export const AnimatedCounter = memo<AnimatedCounterProps>(({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  className,
  format = (v) => v.toLocaleString(),
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (endValue - startValue) * easeOutQuart;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{format(Math.round(displayValue))}{suffix}
    </span>
  );
});
AnimatedCounter.displayName = 'AnimatedCounter';

// =============================================================================
// LOADING SHIMMER
// =============================================================================

interface LoadingShimmerProps {
  className?: string;
  lines?: number;
  type?: 'text' | 'card' | 'avatar' | 'custom';
}

export const LoadingShimmer = memo<LoadingShimmerProps>(({
  className,
  lines = 3,
  type = 'text',
}) => {
  if (type === 'card') {
    return (
      <div className={cn('space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800', className)}>
        <div className="h-6 w-3/4 animate-pulse rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  if (type === 'avatar') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
          style={{ width: `${Math.max(50, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
});
LoadingShimmer.displayName = 'LoadingShimmer';

// =============================================================================
// TOAST NOTIFICATION
// =============================================================================

interface ToastNotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const ToastNotification = memo<ToastNotificationProps>(({
  type,
  title,
  message,
  onClose,
  action,
}) => {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  };
  
  const colors = {
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
    info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
  };
  
  const iconColors = {
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const Icon = icons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 shadow-lg',
        colors[type]
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', iconColors[type])} />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {action.label} →
          </button>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
});
ToastNotification.displayName = 'ToastNotification';

// =============================================================================
// AI SPARKLE BADGE
// =============================================================================

interface AIBadgeProps {
  label?: string;
  variant?: 'default' | 'minimal' | 'gradient';
  animated?: boolean;
  className?: string;
}

export const AIBadge = memo<AIBadgeProps>(({
  label = 'AI',
  variant = 'default',
  animated = true,
  className,
}) => {
  const variants = {
    default: 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200/50 dark:from-purple-900/30 dark:to-blue-900/30 dark:text-purple-300 dark:border-purple-700/30',
    minimal: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    gradient: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25',
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        variants[variant],
        className
      )}
    >
      <Sparkles className={cn('h-3 w-3', animated && 'animate-pulse')} />
      {label}
    </motion.span>
  );
});
AIBadge.displayName = 'AIBadge';

// =============================================================================
// BREADCRUMB NAV
// =============================================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const BreadcrumbNav = memo<BreadcrumbNavProps>(({ items, className }) => {
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          {item.href && index < items.length - 1 ? (
            <a
              href={item.href}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </a>
          ) : (
            <span className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
});
BreadcrumbNav.displayName = 'BreadcrumbNav';

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export const EmptyState = memo<EmptyStateProps>(({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {action && (
        <ProfessionalButton
          variant="primary"
          size="sm"
          icon={action.icon}
          onClick={action.onClick}
        >
          {action.label}
        </ProfessionalButton>
      )}
    </motion.div>
  );
});
EmptyState.displayName = 'EmptyState';

// =============================================================================
// EXPORTS
// =============================================================================

export {
  glassCardVariants,
  statusPillVariants,
  professionalButtonVariants,
};
