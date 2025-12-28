/**
 * Filter Chips Component
 * Displays active filters as removable chips/badges
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, XCircle } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface FilterChip {
  id: string;
  label: string;
  value: string;
  color?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

interface FilterChipsProps {
  /** Array of active filters */
  filters: FilterChip[];
  /** Callback when a filter is removed */
  onRemove: (id: string) => void;
  /** Callback when all filters are cleared */
  onClearAll?: () => void;
  /** Show clear all button */
  showClearAll?: boolean;
  /** Additional className */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

const colorVariants = {
  default: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
  blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  green: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200',
  red: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200',
  purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200',
};

export function FilterChips({
  filters,
  onRemove,
  onClearAll,
  showClearAll = true,
  className,
  compact = false,
}: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <AnimatePresence mode="popLayout">
        {filters.map((filter, index) => (
          <motion.div
            key={filter.id}
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
          >
            <Badge
              variant="outline"
              className={cn(
                'group pr-1 transition-all duration-200 cursor-default',
                colorVariants[filter.color || 'default'],
                compact ? 'h-6 text-xs' : 'h-7 text-sm'
              )}
            >
              <span className="font-medium">{filter.label}:</span>
              <span className="ml-1 opacity-90">{filter.value}</span>
              <button
                onClick={() => onRemove(filter.id)}
                className={cn(
                  'ml-1.5 rounded-full transition-colors opacity-60 hover:opacity-100',
                  compact ? 'p-0.5' : 'p-1'
                )}
                aria-label={`Remove ${filter.label} filter`}
              >
                <X className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
              </button>
            </Badge>
          </motion.div>
        ))}
      </AnimatePresence>

      {showClearAll && filters.length > 1 && onClearAll && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: filters.length * 0.03 }}
        >
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'sm'}
            onClick={onClearAll}
            className={cn(
              'h-auto py-1 px-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            <XCircle className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'mr-1')} />
            Clear all
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Hook to manage filter chips state
 */
export function useFilterChips() {
  const [filters, setFilters] = React.useState<FilterChip[]>([]);

  const addFilter = React.useCallback((filter: FilterChip) => {
    setFilters(prev => {
      // Remove existing filter with same id
      const filtered = prev.filter(f => f.id !== filter.id);
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = React.useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setFilters([]);
  }, []);

  const hasFilters = filters.length > 0;

  return {
    filters,
    addFilter,
    removeFilter,
    clearAll,
    hasFilters,
  };
}
