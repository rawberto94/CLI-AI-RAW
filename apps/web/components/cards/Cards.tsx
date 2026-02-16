'use client';

/**
 * Card Components
 * Versatile card layouts with variants
 */

import React from 'react';
import Link from 'next/link';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { ChevronRight, ExternalLink, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}

// ============================================================================
// Card Component
// ============================================================================

const variantClasses = {
  default: 'bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700',
  bordered: 'bg-white border-2 border-slate-200 dark:bg-slate-800 dark:border-slate-600',
  elevated: 'bg-white shadow-xl shadow-slate-200/50 dark:bg-slate-800 dark:shadow-slate-900/50',
  ghost: 'bg-slate-50 dark:bg-slate-800/50',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -4, shadow: '0 20px 40px rgba(124, 58, 237, 0.1)' } : undefined}
      className={cn(
        'rounded-2xl transition-all duration-300',
        variantClasses[variant],
        paddingClasses[padding],
        hover && 'cursor-pointer hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-lg hover:shadow-violet-500/5',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Card Header
// ============================================================================

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/50',
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-sm', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================================================
// Card Content
// ============================================================================

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('mt-4', className)}>{children}</div>;
}

// ============================================================================
// Card Footer
// ============================================================================

export function CardFooter({ children, className, bordered = false }: CardFooterProps) {
  return (
    <div
      className={cn(
        'mt-4 pt-4',
        bordered && 'border-t border-slate-100',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/50',
  className,
}: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50',
    down: 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/50',
    neutral: 'text-slate-700 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  };

  return (
    <Card className={className} hover>
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shadow-sm', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        {change && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-lg',
              trendColors[change.trend]
            )}
          >
            {change.trend === 'up' ? '+' : change.trend === 'down' ? '-' : ''}
            {Math.abs(change.value)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1 tracking-tight">{value}</p>
      </div>
    </Card>
  );
}

// ============================================================================
// Link Card
// ============================================================================

interface LinkCardProps {
  title: string;
  description?: string;
  href: string;
  icon?: LucideIcon;
  iconColor?: string;
  external?: boolean;
  className?: string;
}

export function LinkCard({
  title,
  description,
  href,
  icon: Icon,
  iconColor = 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/50',
  external = false,
  className,
}: LinkCardProps) {
  const Component = external ? 'a' : Link;
  const props = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Component href={href} {...props}>
      <motion.div
        whileHover={{ y: -4 }}
        className={cn(
          'p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl group cursor-pointer transition-all duration-300 hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-lg hover:shadow-violet-500/5',
          className
        )}
      >
        <div className="flex items-start justify-between">
          {Icon && (
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-violet-500/20', iconColor)}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <motion.div
            initial={{ x: 0, opacity: 0.5 }}
            whileHover={{ x: 4, opacity: 1 }}
            className="text-slate-400 group-hover:text-violet-500 transition-colors"
          >
            {external ? (
              <ExternalLink className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </motion.div>
        </div>
        <div className="mt-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
      </motion.div>
    </Component>
  );
}

// ============================================================================
// Feature Card
// ============================================================================

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  tag?: string;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  iconColor = 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/50',
  tag,
  className,
}: FeatureCardProps) {
  return (
    <Card className={cn('relative overflow-hidden group', className)} hover>
      {tag && (
        <span className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 dark:from-violet-900/50 dark:to-purple-900/50 dark:text-violet-300 rounded-lg">
          {tag}
        </span>
      )}
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110', iconColor)}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mt-4 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{description}</p>
    </Card>
  );
}

// ============================================================================
// Card Grid
// ============================================================================

interface CardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function CardGrid({ children, columns = 3, className }: CardGridProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6', columnClasses[columns], className)}>
      {children}
    </div>
  );
}
