'use client';

/**
 * Enhanced Badge Components
 * Status badges with animations, variants, and interactive states
 */

import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { 
  Check, 
  X, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  Clock, 
  Zap,
  Shield,
  Star,
  TrendingUp,
  TrendingDown,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Enhanced Badge
// ============================================

interface EnhancedBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  variant?: 
    | 'default' 
    | 'secondary' 
    | 'success' 
    | 'warning' 
    | 'danger' 
    | 'info' 
    | 'premium'
    | 'outline'
    | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  pulse?: boolean;
  glow?: boolean;
  dot?: boolean;
  dotColor?: string;
}

const badgeVariants = {
  default: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
  secondary: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  success: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  premium: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20',
  outline: 'bg-transparent border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300',
  subtle: 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400',
};

const glowVariants = {
  default: 'shadow-slate-500/30',
  secondary: 'shadow-slate-500/20',
  success: 'shadow-violet-500/40',
  warning: 'shadow-amber-500/40',
  danger: 'shadow-red-500/40',
  info: 'shadow-violet-500/40',
  premium: 'shadow-orange-500/50',
  outline: 'shadow-slate-500/20',
  subtle: 'shadow-slate-500/10',
};

const sizeClasses = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

const iconSizes = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export const EnhancedBadge = forwardRef<HTMLSpanElement, EnhancedBadgeProps>(
  ({
    variant = 'default',
    size = 'sm',
    icon,
    removable = false,
    onRemove,
    pulse = false,
    glow = false,
    dot = false,
    dotColor,
    className,
    children,
    ...props
  }, ref) => {
    return (
      <motion.span
        ref={ref}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'relative inline-flex items-center font-medium rounded-full whitespace-nowrap',
          badgeVariants[variant],
          sizeClasses[size],
          glow && `shadow-lg ${glowVariants[variant]}`,
          className
        )}
        {...props}
      >
        {/* Pulse animation */}
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full bg-current opacity-30"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Dot indicator */}
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full', dotColor || 'bg-current')}
          />
        )}

        {/* Icon */}
        {icon && <span className={iconSizes[size]}>{icon}</span>}

        {/* Content */}
        <span className="relative z-10">{children}</span>

        {/* Remove button */}
        {removable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className={iconSizes[size]} />
          </button>
        )}
      </motion.span>
    );
  }
);
EnhancedBadge.displayName = 'EnhancedBadge';

// ============================================
// Status Badge
// ============================================

type StatusType = 'online' | 'offline' | 'away' | 'busy' | 'pending' | 'active' | 'inactive';

interface StatusBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref' | 'children'> {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, { color: string; bgColor: string; label: string; dotClass: string }> = {
  online: {
    color: 'text-violet-700 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Online',
    dotClass: 'bg-violet-500',
  },
  offline: {
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    label: 'Offline',
    dotClass: 'bg-slate-400',
  },
  away: {
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Away',
    dotClass: 'bg-amber-500',
  },
  busy: {
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Busy',
    dotClass: 'bg-red-500',
  },
  pending: {
    color: 'text-violet-700 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Pending',
    dotClass: 'bg-violet-500',
  },
  active: {
    color: 'text-violet-700 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    label: 'Active',
    dotClass: 'bg-violet-500',
  },
  inactive: {
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    label: 'Inactive',
    dotClass: 'bg-slate-400',
  },
};

export function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'sm',
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {(status === 'online' || status === 'active') && (
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', config.dotClass)} />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', config.dotClass)} />
        </span>
      )}
      {label || config.label}
    </motion.span>
  );
}

// ============================================
// Count Badge
// ============================================

interface CountBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref'> {
  count: number;
  max?: number;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'default',
  size = 'sm',
  showZero = false,
  className,
  ...props
}: CountBadgeProps) {
  if (count === 0 && !showZero) return null;

  const countVariants = {
    default: 'bg-slate-600 text-white',
    primary: 'bg-violet-600 text-white',
    danger: 'bg-red-600 text-white',
    success: 'bg-violet-600 text-white',
  };

  const countSizes = {
    sm: 'min-w-[18px] h-[18px] text-[10px] px-1',
    md: 'min-w-[22px] h-[22px] text-xs px-1.5',
    lg: 'min-w-[26px] h-[26px] text-sm px-2',
  };

  return (
    <motion.span
      key={count}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className={cn(
        'inline-flex items-center justify-center font-bold rounded-full',
        countVariants[variant],
        countSizes[size],
        className
      )}
      {...props}
    >
      {count > max ? `${max}+` : count}
    </motion.span>
  );
}

// ============================================
// Trend Badge
// ============================================

interface TrendBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref'> {
  value: number;
  suffix?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  neutral?: boolean;
}

export function TrendBadge({
  value,
  suffix = '%',
  showIcon = true,
  size = 'sm',
  neutral = false,
  className,
  ...props
}: TrendBadgeProps) {
  const isPositive = value >= 0;
  const isNeutral = value === 0 || neutral;

  const trendConfig = isNeutral
    ? { icon: Circle, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' }
    : isPositive
    ? { icon: TrendingUp, color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' }
    : { icon: TrendingDown, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };

  const Icon = trendConfig.icon;

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        trendConfig.bg,
        trendConfig.color,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {isPositive && !isNeutral && '+'}
      {value}
      {suffix}
    </motion.span>
  );
}

// ============================================
// Priority Badge
// ============================================

type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

interface PriorityBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref'> {
  priority: PriorityLevel;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const priorityConfig: Record<PriorityLevel, { color: string; bg: string; icon: typeof Zap; label: string }> = {
  critical: {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: Zap,
    label: 'Critical',
  },
  high: {
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: AlertTriangle,
    label: 'High',
  },
  medium: {
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Clock,
    label: 'Medium',
  },
  low: {
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    icon: Info,
    label: 'Low',
  },
  none: {
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    icon: Circle,
    label: 'None',
  },
};

export function PriorityBadge({
  priority,
  showLabel = true,
  size = 'sm',
  className,
  ...props
}: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        config.bg,
        config.color,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <Icon className={cn(iconSizes[size], priority === 'critical' && 'animate-pulse')} />
      {showLabel && config.label}
    </motion.span>
  );
}

// ============================================
// Feature Badge
// ============================================

type FeatureType = 'new' | 'beta' | 'alpha' | 'deprecated' | 'pro' | 'enterprise';

interface FeatureBadgeProps extends Omit<HTMLMotionProps<'span'>, 'ref'> {
  type: FeatureType;
  size?: 'sm' | 'md';
}

const featureConfig: Record<FeatureType, { bg: string; text: string; label: string; icon?: typeof Sparkles }> = {
  new: {
    bg: 'bg-gradient-to-r from-violet-500 to-violet-500',
    text: 'text-white',
    label: 'NEW',
    icon: Sparkles,
  },
  beta: {
    bg: 'bg-gradient-to-r from-violet-500 to-purple-500',
    text: 'text-white',
    label: 'BETA',
  },
  alpha: {
    bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
    text: 'text-white',
    label: 'ALPHA',
  },
  deprecated: {
    bg: 'bg-slate-200 dark:bg-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    label: 'DEPRECATED',
  },
  pro: {
    bg: 'bg-gradient-to-r from-amber-400 to-orange-500',
    text: 'text-white',
    label: 'PRO',
    icon: Star,
  },
  enterprise: {
    bg: 'bg-gradient-to-r from-slate-700 to-slate-900',
    text: 'text-white',
    label: 'ENTERPRISE',
    icon: Shield,
  },
};

export function FeatureBadge({
  type,
  size = 'sm',
  className,
  ...props
}: FeatureBadgeProps) {
  const config = featureConfig[type];
  const Icon = config.icon;

  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={cn(
        'inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-full shadow-sm',
        config.bg,
        config.text,
        size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1',
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </motion.span>
  );
}

// ============================================
// Badge Group
// ============================================

interface BadgeGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeGroup({ children, max = 3, size = 'sm' }: BadgeGroupProps) {
  const childArray = React.Children.toArray(children);
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {visible}
      {remaining > 0 && (
        <EnhancedBadge variant="secondary" size={size}>
          +{remaining}
        </EnhancedBadge>
      )}
    </div>
  );
}

// ============================================
// Animated Badge List
// ============================================

interface AnimatedBadgeListProps {
  badges: Array<{ id: string; label: string; variant?: EnhancedBadgeProps['variant'] }>;
  onRemove?: (id: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedBadgeList({ badges, onRemove, size = 'sm' }: AnimatedBadgeListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence mode="popLayout">
        {badges.map((badge) => (
          <motion.div
            key={badge.id}
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <EnhancedBadge
              variant={badge.variant || 'secondary'}
              size={size}
              removable={!!onRemove}
              onRemove={() => onRemove?.(badge.id)}
            >
              {badge.label}
            </EnhancedBadge>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default {
  EnhancedBadge,
  StatusBadge,
  CountBadge,
  TrendBadge,
  PriorityBadge,
  FeatureBadge,
  BadgeGroup,
  AnimatedBadgeList,
};
