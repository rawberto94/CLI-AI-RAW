'use client';

/**
 * Navigation Components
 * Animated tabs, breadcrumbs, pagination, steppers
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Home, Check, Circle, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ============================================
// Animated Tabs
// ============================================

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline' | 'enclosed';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function AnimatedTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
}: AnimatedTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeIndex = tabs.findIndex(t => t.id === activeTab);
    const activeTabRef = tabRefs.current[activeIndex];
    
    if (activeTabRef) {
      setIndicatorStyle({
        left: activeTabRef.offsetLeft,
        width: activeTabRef.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  const sizeStyles = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-base px-5 py-3',
  };

  const variantContainerStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 rounded-xl p-1',
    pills: 'gap-2',
    underline: 'border-b border-slate-200 dark:border-slate-700',
    enclosed: 'border-b border-slate-200 dark:border-slate-700',
  };

  const getTabStyle = (isActive: boolean, isDisabled: boolean) => {
    const base = cn(sizeStyles[size], 'relative flex items-center gap-2 font-medium transition-colors');
    
    if (isDisabled) {
      return cn(base, 'text-slate-400 cursor-not-allowed');
    }

    switch (variant) {
      case 'default':
        return cn(base, isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white');
      case 'pills':
        return cn(base, 'rounded-full', isActive ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800');
      case 'underline':
        return cn(base, 'pb-3', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white');
      case 'enclosed':
        return cn(
          base,
          '-mb-px border-x border-t rounded-t-lg',
          isActive
            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
            : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
        );
    }
  };

  return (
    <div className={cn('flex', fullWidth && 'w-full', variantContainerStyles[variant])}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={cn(getTabStyle(tab.id === activeTab, !!tab.disabled), fullWidth && 'flex-1 justify-center')}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge && (
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
              tab.id === activeTab
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
      
      {/* Animated indicator for default and underline variants */}
      {(variant === 'default' || variant === 'underline') && (
        <motion.div
          layoutId="tab-indicator"
          className={cn(
            'absolute',
            variant === 'default'
              ? 'bg-white dark:bg-slate-700 rounded-lg shadow-sm inset-y-1'
              : 'bg-blue-500 h-0.5 bottom-0'
          )}
          style={indicatorStyle}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </div>
  );
}

// ============================================
// Tab Panels
// ============================================

interface TabPanelProps {
  children: React.ReactNode;
  value: string;
  activeValue: string;
}

export function TabPanel({ children, value, activeValue }: TabPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {value === activeValue && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Breadcrumbs
// ============================================

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  homeIcon?: boolean;
}

export function Breadcrumbs({
  items,
  separator = <ChevronRight className="w-4 h-4 text-slate-400" />,
  maxItems,
  homeIcon = true,
}: BreadcrumbsProps) {
  const displayItems = maxItems && items.length > maxItems
    ? [
        items[0],
        { label: '...', collapsed: true },
        ...items.slice(-(maxItems - 2)),
      ]
    : items;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 flex-wrap">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isCollapsed = 'collapsed' in item;

          return (
            <li key={index} className="flex items-center gap-2">
              {isCollapsed ? (
                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </button>
              ) : item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  {index === 0 && homeIcon ? (
                    <Home className="w-4 h-4" />
                  ) : (
                    item.icon
                  )}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className={cn(
                  'flex items-center gap-1.5 text-sm',
                  isLast ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-400'
                )}>
                  {index === 0 && homeIcon && <Home className="w-4 h-4" />}
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
              
              {!isLast && (
                <span className="flex-shrink-0">{separator}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================
// Pagination
// ============================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showFirstLast?: boolean;
  showPageNumbers?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  showPageNumbers = true,
  size = 'md',
}: PaginationProps) {
  const generatePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);

    const showLeftEllipsis = leftSibling > 2;
    const showRightEllipsis = rightSibling < totalPages - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      for (let i = 1; i <= Math.max(rightSibling, 3); i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(totalPages);
    } else if (showLeftEllipsis && !showRightEllipsis) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = Math.min(leftSibling, totalPages - 2); i <= totalPages; i++) pages.push(i);
    } else if (showLeftEllipsis && showRightEllipsis) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = leftSibling; i <= rightSibling; i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(totalPages);
    } else {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    }

    return pages;
  };

  const sizeStyles = {
    sm: 'h-8 min-w-8 text-sm',
    md: 'h-10 min-w-10 text-sm',
    lg: 'h-12 min-w-12 text-base',
  };

  const buttonClass = cn(
    sizeStyles[size],
    'flex items-center justify-center rounded-lg font-medium transition-all',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
  );

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          buttonClass,
          'px-2',
          currentPage === 1
            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        )}
      >
        <ChevronLeft className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        <span className="sr-only">Previous</span>
      </button>

      {/* Page numbers */}
      {showPageNumbers && generatePages().map((page, index) => (
        page === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className={cn(buttonClass, 'text-slate-400')}>
            ...
          </span>
        ) : (
          <motion.button
            key={page}
            onClick={() => onPageChange(page)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              buttonClass,
              'px-3',
              page === currentPage
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            {page}
          </motion.button>
        )
      ))}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          buttonClass,
          'px-2',
          currentPage === totalPages
            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        )}
      >
        <ChevronRight className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        <span className="sr-only">Next</span>
      </button>
    </nav>
  );
}

// ============================================
// Stepper
// ============================================

interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'compact' | 'circles';
  clickable?: boolean;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  orientation = 'horizontal',
  variant = 'default',
  clickable = false,
}: StepperProps) {
  const getStepStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'upcoming';
  };

  if (orientation === 'vertical') {
    return (
      <div className="space-y-0">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex gap-4">
              {/* Indicator column */}
              <div className="flex flex-col items-center">
                <motion.button
                  onClick={() => clickable && onStepClick?.(index)}
                  disabled={!clickable}
                  animate={{
                    scale: status === 'current' ? 1.1 : 1,
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    !clickable && 'cursor-default',
                    status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : status === 'current'
                      ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    <span className="font-medium">{index + 1}</span>
                  )}
                </motion.button>
                
                {!isLast && (
                  <div className={cn(
                    'w-0.5 flex-1 my-2',
                    status === 'completed' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                  )} />
                )}
              </div>

              {/* Content column */}
              <div className={cn('pb-8', isLast && 'pb-0')}>
                <div className={cn(
                  'font-medium',
                  status === 'current' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'
                )}>
                  {step.label}
                  {step.optional && (
                    <span className="ml-2 text-xs text-slate-400">(Optional)</span>
                  )}
                </div>
                {step.description && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal stepper
  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className={cn('flex items-center', variant === 'compact' ? 'gap-2' : 'gap-3')}>
              <motion.button
                onClick={() => clickable && onStepClick?.(index)}
                disabled={!clickable}
                animate={{
                  scale: status === 'current' ? 1.1 : 1,
                }}
                className={cn(
                  'rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0',
                  !clickable && 'cursor-default',
                  variant === 'compact' ? 'w-8 h-8' : 'w-10 h-10',
                  status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : status === 'current'
                    ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-500/30'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                )}
              >
                {status === 'completed' ? (
                  <Check className={cn(variant === 'compact' ? 'w-4 h-4' : 'w-5 h-5')} />
                ) : step.icon ? (
                  step.icon
                ) : (
                  <span className={cn('font-medium', variant === 'compact' && 'text-sm')}>
                    {index + 1}
                  </span>
                )}
              </motion.button>

              {variant !== 'circles' && (
                <div className="hidden sm:block">
                  <div className={cn(
                    'font-medium whitespace-nowrap',
                    variant === 'compact' ? 'text-sm' : 'text-base',
                    status === 'current' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'
                  )}>
                    {step.label}
                  </div>
                  {step.description && variant === 'default' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
                  )}
                </div>
              )}
            </div>

            {!isLast && (
              <div className={cn(
                'flex-1 h-0.5 mx-4',
                status === 'completed' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================
// Progress Steps (Alternative Design)
// ============================================

interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  variant?: 'dots' | 'numbers' | 'line';
}

export function ProgressSteps({
  steps,
  currentStep,
  variant = 'dots',
}: ProgressStepsProps) {
  if (variant === 'line') {
    const progress = ((currentStep) / (steps.length - 1)) * 100;

    return (
      <div className="space-y-3">
        <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          
          {/* Step markers */}
          <div className="absolute inset-0 flex items-center justify-between px-0">
            {steps.map((_, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0 }}
                animate={{ scale: index <= currentStep ? 1 : 0.5 }}
                className={cn(
                  'w-4 h-4 rounded-full border-2 border-white dark:border-slate-900',
                  index <= currentStep
                    ? 'bg-blue-500'
                    : 'bg-slate-300 dark:bg-slate-600'
                )}
              />
            ))}
          </div>
        </div>
        
        <div className="flex justify-between text-xs">
          {steps.map((step, index) => (
            <span
              key={index}
              className={cn(
                index <= currentStep
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-slate-400'
              )}
            >
              {step}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <motion.div
            animate={{
              scale: index === currentStep ? 1.2 : 1,
            }}
            className={cn(
              'transition-colors',
              variant === 'dots'
                ? cn(
                    'w-2.5 h-2.5 rounded-full',
                    index < currentStep
                      ? 'bg-green-500'
                      : index === currentStep
                      ? 'bg-blue-500 ring-4 ring-blue-500/30'
                      : 'bg-slate-300 dark:bg-slate-600'
                  )
                : cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    index < currentStep
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                      ? 'bg-blue-500 text-white ring-4 ring-blue-500/30'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  )
            )}
          >
            {variant === 'numbers' && (
              index < currentStep ? <Check className="w-4 h-4" /> : index + 1
            )}
          </motion.div>
          
          {index < steps.length - 1 && (
            <div className={cn(
              'w-8 h-0.5',
              index < currentStep
                ? 'bg-green-500'
                : 'bg-slate-200 dark:bg-slate-700'
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// Segmented Control
// ============================================

interface SegmentedControlProps {
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
}: SegmentedControlProps) {
  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  return (
    <div className={cn(
      'inline-flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1',
      fullWidth && 'w-full'
    )}>
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'relative flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
            sizeStyles[size],
            fullWidth && 'flex-1'
          )}
        >
          {option.value === value && (
            <motion.div
              layoutId="segmented-bg"
              className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className={cn(
            'relative z-10 flex items-center gap-2',
            option.value === value
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
          )}>
            {option.icon}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Page Header with Navigation
// ============================================

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  tabs,
  activeTab,
  onTabChange,
}: PageHeaderProps) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="px-6 py-4">
        {breadcrumbs && (
          <div className="mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>
      
      {tabs && activeTab && onTabChange && (
        <div className="px-6">
          <AnimatedTabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={onTabChange}
            variant="underline"
          />
        </div>
      )}
    </div>
  );
}

export default {
  AnimatedTabs,
  TabPanel,
  Breadcrumbs,
  Pagination,
  Stepper,
  ProgressSteps,
  SegmentedControl,
  PageHeader,
};
