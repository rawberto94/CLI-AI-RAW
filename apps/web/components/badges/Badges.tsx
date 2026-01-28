'use client';

/**
 * Badge & Chip Components
 * Status indicators, labels, and interactive chips
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type BadgeVariant = 'default' | 'outline' | 'soft';
type BadgeColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'pink';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  icon?: LucideIcon;
  dot?: boolean;
  dotPulse?: boolean;
  className?: string;
}

interface ChipProps extends Omit<BadgeProps, 'dot' | 'dotPulse'> {
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
}

// ============================================================================
// Color Classes
// ============================================================================

const colorClasses: Record<BadgeVariant, Record<BadgeColor, string>> = {
  default: {
    slate: 'bg-slate-700 text-white',
    indigo: 'bg-purple-600 text-white',
    emerald: 'bg-violet-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-red-600 text-white',
    blue: 'bg-violet-600 text-white',
    purple: 'bg-purple-600 text-white',
    pink: 'bg-pink-600 text-white',
  },
  outline: {
    slate: 'border border-slate-300 text-slate-700',
    indigo: 'border border-indigo-300 text-purple-700',
    emerald: 'border border-violet-300 text-violet-700',
    amber: 'border border-amber-300 text-amber-700',
    red: 'border border-red-300 text-red-700',
    blue: 'border border-violet-300 text-violet-700',
    purple: 'border border-purple-300 text-purple-700',
    pink: 'border border-pink-300 text-pink-700',
  },
  soft: {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-purple-100 text-purple-700',
    emerald: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-violet-100 text-violet-700',
    purple: 'bg-purple-100 text-purple-700',
    pink: 'bg-pink-100 text-pink-700',
  },
};

const dotColors: Record<BadgeColor, string> = {
  slate: 'bg-slate-500',
  indigo: 'bg-purple-500',
  emerald: 'bg-violet-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-violet-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

// ============================================================================
// Badge Component
// ============================================================================

export function Badge({
  children,
  variant = 'soft',
  color = 'slate',
  size = 'md',
  icon: Icon,
  dot = false,
  dotPulse = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        colorClasses[variant][color],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {dotPulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotColors[color]
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              dotColors[color]
            )}
          />
        </span>
      )}
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

// ============================================================================
// Chip Component (Interactive Badge)
// ============================================================================

export function Chip({
  children,
  variant = 'soft',
  color = 'slate',
  size = 'md',
  icon: Icon,
  onRemove,
  onClick,
  selected = false,
  className,
}: ChipProps) {
  const isInteractive = onClick || onRemove;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileTap={isInteractive ? { scale: 0.95 } : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap transition-all',
        colorClasses[variant][color],
        sizeClasses[size],
        isInteractive && 'cursor-pointer',
        selected && variant === 'soft' && 'ring-2 ring-offset-1',
        selected && color === 'indigo' && 'ring-indigo-400',
        className
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.span>
  );
}

// ============================================================================
// Status Badge (Common presets)
// ============================================================================

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'active' | 'inactive';

const statusConfig: Record<StatusType, { color: BadgeColor; dot?: boolean; dotPulse?: boolean }> = {
  success: { color: 'violet', dot: true },
  warning: { color: 'amber', dot: true },
  error: { color: 'red', dot: true },
  info: { color: 'blue', dot: true },
  pending: { color: 'amber', dot: true, dotPulse: true },
  active: { color: 'violet', dot: true, dotPulse: true },
  inactive: { color: 'slate', dot: true },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({ status, label, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge
      variant="soft"
      color={config.color}
      size={size}
      dot={config.dot}
      dotPulse={config.dotPulse}
      className={className}
    >
      {displayLabel}
    </Badge>
  );
}

// ============================================================================
// Chip Group
// ============================================================================

interface ChipGroupProps {
  items: { id: string; label: string; icon?: LucideIcon }[];
  selected?: string[];
  onChange?: (selected: string[]) => void;
  multiple?: boolean;
  color?: BadgeColor;
  size?: BadgeSize;
  className?: string;
}

export function ChipGroup({
  items,
  selected = [],
  onChange,
  multiple = false,
  color = 'indigo',
  size = 'md',
  className,
}: ChipGroupProps) {
  const handleClick = (id: string) => {
    if (!onChange) return;

    if (multiple) {
      const newSelected = selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id];
      onChange(newSelected);
    } else {
      onChange(selected.includes(id) ? [] : [id]);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <AnimatePresence>
        {items.map((item) => (
          <Chip
            key={item.id}
            variant={selected.includes(item.id) ? 'default' : 'outline'}
            color={selected.includes(item.id) ? color : 'slate'}
            size={size}
            icon={item.icon}
            onClick={() => handleClick(item.id)}
          >
            {item.label}
          </Chip>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Badge Group (For displaying multiple badges)
// ============================================================================

interface BadgeGroupProps {
  badges: { label: string; color?: BadgeColor }[];
  max?: number;
  size?: BadgeSize;
  className?: string;
}

export function BadgeGroup({ badges, max = 3, size = 'sm', className }: BadgeGroupProps) {
  const visibleBadges = badges.slice(0, max);
  const remainingCount = badges.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleBadges.map((badge, index) => (
        <Badge key={index} variant="soft" color={badge.color} size={size}>
          {badge.label}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" color="slate" size={size}>
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// Count Badge (For notifications, etc.)
// ============================================================================

interface CountBadgeProps {
  count: number;
  max?: number;
  color?: BadgeColor;
  className?: string;
}

export function CountBadge({ count, max = 99, color = 'red', className }: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full',
        colorClasses.default[color],
        className
      )}
    >
      {displayCount}
    </span>
  );
}
