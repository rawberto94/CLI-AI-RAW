/**
 * Professional Page Components
 * 
 * Layout and visual hierarchy components for a polished experience
 */

'use client';

import React, { memo, forwardRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LucideIcon,
  ChevronRight,
  Home,
  ArrowLeft,
  MoreVertical,
  Search,
  Bell,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

// =============================================================================
// PAGE HEADER
// Professional page header with breadcrumbs and actions
// =============================================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface PageAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumbs?: BreadcrumbItem[];
  actions?: PageAction[];
  moreActions?: PageAction[];
  badge?: {
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  backHref?: string;
  onBack?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const PageHeader = memo<PageHeaderProps>(({
  title,
  subtitle,
  icon: Icon,
  breadcrumbs,
  actions,
  moreActions,
  badge,
  backHref,
  onBack,
  className,
  children,
}) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      window.location.href = backHref;
    } else {
      window.history.back();
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60',
        className
      )}
    >
      <div className="px-6 py-4">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-sm mb-3">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Home className="h-4 w-4" />
            </Link>
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-700" />
                {item.href && index < breadcrumbs.length - 1 ? (
                  <a
                    href={item.href}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                  >
                    {item.icon && <item.icon className="h-3.5 w-3.5" />}
                    {item.label}
                  </a>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
                    {item.icon && <item.icon className="h-3.5 w-3.5" />}
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-start justify-between gap-4">
          {/* Left side: Title and info */}
          <div className="flex items-start gap-4 min-w-0">
            {/* Back button */}
            {(backHref || onBack) && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            {/* Icon */}
            {Icon && (
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {title}
                </h1>
                {badge && (
                  <Badge variant={badge.variant || 'secondary'}>
                    {badge.label}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions?.map((action, index) => (
              <Button
                key={index}
                variant={
                  action.variant === 'primary' ? 'default' :
                  action.variant === 'destructive' ? 'destructive' :
                  action.variant === 'secondary' ? 'secondary' :
                  action.variant === 'outline' ? 'outline' :
                  'ghost'
                }
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  action.variant === 'primary' && 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25'
                )}
              >
                {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
                {action.label}
              </Button>
            ))}

            {moreActions && moreActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {moreActions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Optional children (tabs, filters, etc.) */}
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    </motion.header>
  );
});
PageHeader.displayName = 'PageHeader';

// =============================================================================
// PAGE CONTAINER
// Main content wrapper with proper spacing
// =============================================================================

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const PageContainer = memo<PageContainerProps>(({
  children,
  className,
  maxWidth = '7xl',
  padding = 'md',
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4',
    md: 'px-6 py-6',
    lg: 'px-8 py-8',
  };

  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
});
PageContainer.displayName = 'PageContainer';

// =============================================================================
// SECTION
// Content section with optional header
// =============================================================================

interface SectionProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const Section = memo<SectionProps>(({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-4', className)}
    >
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
            )}
            <div>
              {title && (
                <h2
                  className={cn(
                    'font-semibold text-gray-900 dark:text-gray-100',
                    collapsible && 'cursor-pointer select-none'
                  )}
                  onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
                >
                  {title}
                  {collapsible && (
                    <motion.span
                      className="inline-block ml-2"
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </motion.span>
                  )}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
            >
              {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
              {action.label}
            </Button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {(!collapsible || isExpanded) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});
Section.displayName = 'Section';

// =============================================================================
// STAT GRID
// Grid of statistics/metrics
// =============================================================================

interface StatItem {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: LucideIcon;
  description?: string;
}

interface StatGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export const StatGrid = memo<StatGridProps>(({
  stats,
  columns = 4,
  className,
}) => {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  };

  return (
    <div className={cn('grid gap-4', columnClasses[columns], className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group relative rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stat.value}
              </p>
              {stat.change && (
                <p
                  className={cn(
                    'text-xs font-medium flex items-center gap-1',
                    stat.change.trend === 'up' && 'text-violet-600',
                    stat.change.trend === 'down' && 'text-red-600',
                    stat.change.trend === 'neutral' && 'text-gray-500'
                  )}
                >
                  {stat.change.trend === 'up' && '↑'}
                  {stat.change.trend === 'down' && '↓'}
                  {stat.change.value}
                </p>
              )}
            </div>
            {stat.icon && (
              <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <stat.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            )}
          </div>
          {stat.description && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {stat.description}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
});
StatGrid.displayName = 'StatGrid';

// =============================================================================
// QUICK ACTIONS BAR
// Floating action bar
// =============================================================================

interface QuickAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: number;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
  className?: string;
}

export const QuickActionsBar = memo<QuickActionsBarProps>(({
  actions,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1 p-2 rounded-2xl',
        'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl',
        'border border-gray-200/60 dark:border-gray-800/60',
        'shadow-2xl shadow-gray-900/10',
        className
      )}
    >
      {actions.map((action, index) => (
        <motion.button
          key={index}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="relative p-3 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={action.label}
        >
          <action.icon className="h-5 w-5" />
          {action.badge !== undefined && action.badge > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {action.badge > 9 ? '9+' : action.badge}
            </span>
          )}
        </motion.button>
      ))}
    </motion.div>
  );
});
QuickActionsBar.displayName = 'QuickActionsBar';

// =============================================================================
// PAGE TABS
// Navigation tabs for page sections
// =============================================================================

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
}

interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const PageTabs = memo<PageTabsProps>(({
  tabs,
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1 border-b border-gray-200 dark:border-gray-800', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
                    isActive
                      ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});
PageTabs.displayName = 'PageTabs';

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  PageHeader,
  PageContainer,
  Section,
  StatGrid,
  QuickActionsBar,
  PageTabs,
};
