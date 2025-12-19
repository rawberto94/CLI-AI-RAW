'use client';

/**
 * Breadcrumbs Navigation
 * Accessible, animated breadcrumb navigation
 */

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Home,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  maxItems?: number;
  separator?: React.ReactNode;
  showHomeIcon?: boolean;
  className?: string;
  variant?: 'default' | 'pills' | 'arrows';
}

// ============================================================================
// Separator Components
// ============================================================================

function DefaultSeparator() {
  return <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />;
}

function ArrowSeparator() {
  return (
    <svg
      className="w-5 h-5 text-slate-300 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M4 12L20 12M20 12L14 6M20 12L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ============================================================================
// Breadcrumb Link Component
// ============================================================================

interface BreadcrumbLinkProps {
  item: BreadcrumbItem;
  isLast: boolean;
  variant: 'default' | 'pills' | 'arrows';
  index: number;
}

function BreadcrumbLink({ item, isLast, variant, index }: BreadcrumbLinkProps) {
  const Icon = item.icon;
  
  const content = (
    <motion.span
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
        variant === 'pills' && 'px-3 py-1.5 rounded-lg',
        isLast
          ? variant === 'pills'
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-slate-900'
          : variant === 'pills'
          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
          : 'text-slate-500 hover:text-slate-700'
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span className="truncate max-w-[150px]">{item.label}</span>
    </motion.span>
  );

  if (isLast || !item.href) {
    return <span aria-current={isLast ? 'page' : undefined}>{content}</span>;
  }

  return (
    <Link href={item.href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
      {content}
    </Link>
  );
}

// ============================================================================
// Collapsed Breadcrumbs
// ============================================================================

interface CollapsedBreadcrumbsProps {
  items: BreadcrumbItem[];
}

function CollapsedBreadcrumbs({ items }: CollapsedBreadcrumbsProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (isExpanded) {
    return (
      <>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <BreadcrumbLink item={item} isLast={false} variant="default" index={idx} />
            <DefaultSeparator />
          </React.Fragment>
        ))}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsExpanded(true)}
        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Show hidden breadcrumbs"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      <DefaultSeparator />
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Breadcrumbs({
  items,
  maxItems = 4,
  separator,
  showHomeIcon = true,
  className,
  variant = 'default',
}: BreadcrumbsProps) {
  const getSeparator = () => {
    if (separator) return separator;
    if (variant === 'arrows') return <ArrowSeparator />;
    return <DefaultSeparator />;
  };

  // Handle truncation
  const shouldTruncate = items.length > maxItems;
  const visibleItems = shouldTruncate
    ? [items[0], ...items.slice(-(maxItems - 1))]
    : items;
  const hiddenItems = shouldTruncate ? items.slice(1, -(maxItems - 1)) : [];

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className={cn(
          'flex items-center flex-wrap',
          variant === 'pills' ? 'gap-1' : 'gap-2'
        )}
      >
        {/* Home icon */}
        {showHomeIcon && (
          <li className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Home"
            >
              <Home className="w-4 h-4" />
            </Link>
            {items.length > 0 && getSeparator()}
          </li>
        )}

        {/* First item */}
        {visibleItems.length > 0 && visibleItems[0] && (
          <li className="flex items-center gap-2">
            <BreadcrumbLink
              item={visibleItems[0]}
              isLast={visibleItems.length === 1}
              variant={variant}
              index={0}
            />
            {visibleItems.length > 1 && getSeparator()}
          </li>
        )}

        {/* Collapsed items */}
        {hiddenItems.length > 0 && (
          <li className="flex items-center gap-2">
            <CollapsedBreadcrumbs items={hiddenItems} />
          </li>
        )}

        {/* Remaining items */}
        {visibleItems.slice(1).map((item, idx) => {
          if (!item) return null;
          return (
            <li key={idx} className="flex items-center gap-2">
              <BreadcrumbLink
                item={item}
                isLast={idx === visibleItems.length - 2}
                variant={variant}
                index={idx + 1}
              />
              {idx < visibleItems.length - 2 && getSeparator()}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================================================
// Page Header with Breadcrumbs
// ============================================================================

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-slate-900"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-600 mt-1"
            >
              {description}
            </motion.p>
          )}
        </div>
        {actions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
}
