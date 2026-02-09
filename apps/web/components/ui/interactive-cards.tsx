'use client';

/**
 * Interactive Card Components
 * Cards with hover effects, selection states, and rich interactions
 */

import React, { forwardRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { Check, ChevronRight, MoreHorizontal, Star, Bookmark, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Hover Card
// ============================================

interface HoverCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  hoverable?: boolean;
  pressable?: boolean;
  glowColor?: string;
}

export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({
    variant = 'default',
    hoverable = true,
    pressable = false,
    glowColor,
    className,
    children,
    onClick,
    ...props
  }, ref) => {
    const baseStyles = 'relative rounded-2xl transition-all duration-300';
    
    const variantStyles = {
      default: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
      elevated: 'bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50',
      bordered: 'bg-transparent border-2 border-slate-200 dark:border-slate-700',
      ghost: 'bg-slate-50 dark:bg-slate-800/50',
    };

    const hoverStyles = hoverable
      ? 'hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600'
      : '';

    const glowStyles = glowColor
      ? `hover:shadow-[0_0_30px_${glowColor}] hover:border-[${glowColor}]`
      : '';

    return (
      <motion.div
        ref={ref}
        whileHover={hoverable ? { scale: 1.01 } : {}}
        whileTap={pressable ? { scale: 0.99 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={onClick}
        className={cn(
          baseStyles,
          variantStyles[variant],
          hoverStyles,
          glowStyles,
          pressable && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
HoverCard.displayName = 'HoverCard';

// ============================================
// Selectable Card
// ============================================

interface SelectableCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  variant?: 'checkbox' | 'radio' | 'highlight';
  disabled?: boolean;
}

export function SelectableCard({
  selected = false,
  onSelect,
  variant = 'checkbox',
  disabled = false,
  className,
  children,
  ...props
}: SelectableCardProps) {
  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      onClick={() => !disabled && onSelect?.()}
      className={cn(
        'relative rounded-2xl p-4 border-2 transition-all duration-200 cursor-pointer',
        selected
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-500/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {/* Selection indicator */}
      {variant === 'checkbox' && (
        <div
          className={cn(
            'absolute top-4 right-4 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
            selected
              ? 'bg-violet-500 border-violet-500 text-white'
              : 'border-slate-300 dark:border-slate-600'
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3 h-3" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {variant === 'radio' && (
        <div
          className={cn(
            'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            selected
              ? 'border-violet-500'
              : 'border-slate-300 dark:border-slate-600'
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-2.5 h-2.5 rounded-full bg-violet-500"
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {variant === 'highlight' && selected && (
        <motion.div
          layoutId="selection-highlight"
          className="absolute inset-0 rounded-2xl bg-violet-500/5 border-2 border-violet-500"
          initial={false}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ============================================
// Action Card
// ============================================

interface ActionCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionCard({
  title,
  description,
  icon,
  action,
  badge,
  href,
  onClick,
  disabled = false,
  className,
  ...props
}: ActionCardProps) {
  const content = (
    <motion.div
      whileHover={!disabled ? { scale: 1.01, x: 4 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      className={cn(
        'relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200',
        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
        !disabled && 'hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={() => !disabled && onClick?.()}
      {...props}
    >
      {/* Icon */}
      {icon && (
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {icon}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>

      {/* Action or Arrow */}
      <div className="flex-shrink-0">
        {action || (
          <ChevronRight className="w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-1" />
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

// ============================================
// Expandable Card
// ============================================

interface ExpandableCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  title: string;
  preview?: string;
  expanded?: boolean;
  onToggle?: () => void;
  icon?: React.ReactNode;
}

export function ExpandableCard({
  title,
  preview,
  expanded = false,
  onToggle,
  icon,
  className,
  children,
  ...props
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden',
        className
      )}
      {...props}
    >
      <motion.button
        onClick={handleToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {icon}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          {preview && !isExpanded && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{preview}</p>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-800">
              <div className="pt-4">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// Stats Card
// ============================================

interface StatsCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading = false,
  className,
  ...props
}: StatsCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        'relative p-6 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
        'hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-3xl font-bold text-slate-900 dark:text-white"
            >
              {value}
            </motion.p>
          )}

          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}

          {trend && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-sm font-medium',
                isPositive ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              <span>{isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-slate-500 dark:text-slate-400">{trend.label}</span>}
            </div>
          )}
        </div>

        {icon && (
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Feature Card
// ============================================

interface FeatureCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient?: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  href?: string;
}

const gradients = {
  blue: 'from-violet-500 to-purple-600',
  purple: 'from-violet-500 to-pink-600',
  green: 'from-violet-500 to-violet-600',
  orange: 'from-orange-500 to-amber-600',
  pink: 'from-pink-500 to-rose-600',
};

export function FeatureCard({
  title,
  description,
  icon,
  gradient = 'blue',
  href,
  className,
  ...props
}: FeatureCardProps) {
  const content = (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
        'hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300',
        'cursor-pointer overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Gradient blob */}
      <div
        className={cn(
          'absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity',
          `bg-gradient-to-br ${gradients[gradient]}`
        )}
      />

      <div className="relative z-10">
        <div
          className={cn(
            'inline-flex p-3 rounded-xl bg-gradient-to-br text-white shadow-lg',
            gradients[gradient]
          )}
        >
          {icon}
        </div>

        <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>

        {href && (
          <div className="mt-4 flex items-center gap-1 text-sm font-medium text-slate-900 dark:text-white group-hover:gap-2 transition-all">
            Learn more
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}

// ============================================
// Pricing Card
// ============================================

interface PricingCardProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  name: string;
  price: string | number;
  period?: string;
  description?: string;
  features: string[];
  popular?: boolean;
  cta?: { label: string; onClick: () => void };
  disabled?: boolean;
}

export function PricingCard({
  name,
  price,
  period = '/month',
  description,
  features,
  popular = false,
  cta,
  disabled = false,
  className,
  ...props
}: PricingCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        'relative p-6 rounded-2xl border bg-white dark:bg-slate-900 transition-all duration-300',
        popular
          ? 'border-violet-500 shadow-xl shadow-violet-500/10'
          : 'border-slate-200 dark:border-slate-800 hover:shadow-lg',
        className
      )}
      {...props}
    >
      {/* Popular badge */}
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold rounded-full">
          Most Popular
        </div>
      )}

      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{name}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
        
        <div className="mt-4 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">
            {typeof price === 'number' ? `$${price}` : price}
          </span>
          {typeof price === 'number' && (
            <span className="text-slate-500 dark:text-slate-400">{period}</span>
          )}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Check className="w-4 h-4 text-violet-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      {cta && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={cta.onClick}
          disabled={disabled}
          className={cn(
            'mt-6 w-full py-3 rounded-xl font-semibold transition-colors',
            popular
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {cta.label}
        </motion.button>
      )}
    </motion.div>
  );
}

// ============================================
// Card with Actions Menu
// ============================================

interface CardWithActionsProps extends Omit<HTMLMotionProps<'div'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  actions?: Array<{ label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }>;
  favorited?: boolean;
  onFavorite?: () => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
}

export function CardWithActions({
  actions = [],
  favorited = false,
  onFavorite,
  bookmarked = false,
  onBookmark,
  className,
  children,
  ...props
}: CardWithActionsProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      className={cn(
        'relative rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Quick actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        {onFavorite && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onFavorite}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Star
              className={cn(
                'w-4 h-4',
                favorited
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-400'
              )}
            />
          </motion.button>
        )}

        {onBookmark && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBookmark}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bookmark
              className={cn(
                'w-4 h-4',
                bookmarked
                  ? 'fill-violet-500 text-violet-500'
                  : 'text-slate-400'
              )}
            />
          </motion.button>
        )}

        {actions.length > 0 && (
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </motion.button>

            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50"
                  >
                    {actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          action.onClick();
                          setShowMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors',
                          action.danger
                            ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        )}
                      >
                        {action.icon && <span className="w-4 h-4">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {children}
    </motion.div>
  );
}

export default {
  HoverCard,
  SelectableCard,
  ActionCard,
  ExpandableCard,
  StatsCard,
  FeatureCard,
  PricingCard,
  CardWithActions,
};
