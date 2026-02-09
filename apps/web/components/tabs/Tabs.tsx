'use client';

/**
 * Tabs Component
 * Animated tab navigation with multiple variants
 */

import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

type TabVariant = 'underline' | 'pills' | 'enclosed' | 'soft';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  variant: TabVariant;
}

// ============================================================================
// Context
// ============================================================================

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

// ============================================================================
// Tabs Root
// ============================================================================

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  variant?: TabVariant;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onChange,
  variant = 'underline',
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const activeTab = value ?? internalValue;

  const setActiveTab = (id: string) => {
    if (value === undefined) {
      setInternalValue(id);
    }
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ============================================================================
// Tab List
// ============================================================================

interface TabListProps {
  tabs: Tab[];
  className?: string;
  fullWidth?: boolean;
}

export function TabList({ tabs, className, fullWidth = false }: TabListProps) {
  const { activeTab, setActiveTab, variant } = useTabsContext();
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Update indicator position
  useEffect(() => {
    const activeElement = tabRefs.current.get(activeTab);
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  const variantStyles = {
    underline: {
      container: 'border-b border-slate-200 dark:border-slate-700',
      tab: 'px-4 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
      activeTab: 'text-violet-600 dark:text-violet-400',
      indicator: 'absolute bottom-0 h-0.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full',
    },
    pills: {
      container: 'bg-slate-100 dark:bg-slate-800 p-1 rounded-xl',
      tab: 'px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg',
      activeTab: 'text-slate-900 dark:text-slate-100',
      indicator: 'absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm',
    },
    enclosed: {
      container: 'border-b border-slate-200 dark:border-slate-700',
      tab: 'px-4 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent -mb-px rounded-t-lg',
      activeTab: 'text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-900 bg-white dark:bg-slate-900',
      indicator: '', // No indicator for enclosed
    },
    soft: {
      container: 'gap-2',
      tab: 'px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg',
      activeTab: 'text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/50',
      indicator: '',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'relative flex',
        fullWidth && 'w-full',
        styles.container,
        className
      )}
    >
      {/* Animated indicator (for underline and pills) */}
      {(variant === 'underline' || variant === 'pills') && (
        <motion.div
          className={cn(styles.indicator, 'z-0')}
          animate={indicatorStyle}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Tab buttons */}
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'relative z-10 flex items-center gap-2 text-sm font-medium transition-colors',
              fullWidth && 'flex-1 justify-center',
              styles.tab,
              isActive && styles.activeTab,
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs font-semibold rounded-full',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Tab Panels
// ============================================================================

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  keepMounted?: boolean;
}

export function TabPanel({
  value,
  children,
  className,
  keepMounted = false,
}: TabPanelProps) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive && !keepMounted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
      transition={{ duration: 0.2 }}
      className={cn(className, !isActive && 'hidden')}
      role="tabpanel"
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Vertical Tabs
// ============================================================================

interface VerticalTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VerticalTabs({
  tabs,
  activeTab,
  onChange,
  className,
}: VerticalTabsProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-left text-sm font-medium rounded-xl',
              'transition-all duration-200',
              isActive
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'w-5 h-5',
                  isActive ? 'text-violet-600' : 'text-slate-400'
                )}
              />
            )}
            <span className="flex-1">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-semibold rounded-full',
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
