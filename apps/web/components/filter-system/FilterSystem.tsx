'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, X, ChevronDown, ChevronUp, Check, Calendar,
  Search, RotateCcw, SlidersHorizontal, Plus, Minus
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type FilterType = 'select' | 'multiselect' | 'range' | 'date' | 'boolean' | 'search';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface FilterConfig {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface FilterValue {
  [key: string]: string | string[] | [number, number] | [Date, Date] | boolean | null;
}

// ============================================================================
// Filter Panel
// ============================================================================

interface FilterPanelProps {
  filters: FilterConfig[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset?: () => void;
  collapsible?: boolean;
  className?: string;
}

export function FilterPanel({
  filters,
  values,
  onChange,
  onReset,
  collapsible = true,
  className = '',
}: FilterPanelProps) {
  const [expandedFilters, setExpandedFilters] = useState<string[]>(
    filters.map(f => f.id)
  );

  const toggleFilter = (id: string) => {
    setExpandedFilters(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const updateValue = (id: string, value: FilterValue[string]) => {
    onChange({ ...values, [id]: value });
  };

  const activeFilterCount = Object.values(values).filter(v => 
    v !== null && v !== undefined && v !== '' && 
    !(Array.isArray(v) && v.length === 0)
  ).length;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-violet-500" />
          <span className="font-semibold text-slate-900 dark:text-white">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {onReset && activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* Filter Groups */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {filters.map(filter => (
          <div key={filter.id} className="px-4 py-3">
            {collapsible ? (
              <button
                onClick={() => toggleFilter(filter.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {filter.label}
                </span>
                {expandedFilters.includes(filter.id) ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {filter.label}
              </span>
            )}

            <AnimatePresence>
              {(!collapsible || expandedFilters.includes(filter.id)) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <FilterInput
                    filter={filter}
                    value={values[filter.id]}
                    onChange={(v) => updateValue(filter.id, v)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Filter Input
// ============================================================================

interface FilterInputProps {
  filter: FilterConfig;
  value: FilterValue[string];
  onChange: (value: FilterValue[string]) => void;
}

function FilterInput({ filter, value, onChange }: FilterInputProps) {
  switch (filter.type) {
    case 'select':
      return (
        <div className="space-y-1">
          {filter.options?.map(option => (
            <button
              key={option.value}
              onClick={() => onChange(value === option.value ? null : option.value)}
              className={`
                w-full px-3 py-2 flex items-center gap-2 rounded-lg text-left text-sm transition-colors
                ${value === option.value 
                  ? 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400'
                  : 'hover:bg-violet-50/50 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300'
                }
              `}
            >
              {option.icon}
              <span className="flex-1">{option.label}</span>
              {option.count !== undefined && (
                <span className="text-gray-400 text-xs">{option.count}</span>
              )}
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      );

    case 'multiselect':
      const selectedValues = (value as string[]) || [];
      return (
        <div className="space-y-1">
          {filter.options?.map(option => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => {
                  if (isSelected) {
                    onChange(selectedValues.filter(v => v !== option.value));
                  } else {
                    onChange([...selectedValues, option.value]);
                  }
                }}
                className={`
                  w-full px-3 py-2 flex items-center gap-2 rounded-lg text-left text-sm transition-colors
                  ${isSelected 
                    ? 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400'
                    : 'hover:bg-violet-50/50 dark:hover:bg-violet-950/30 text-slate-700 dark:text-slate-300'
                  }
                `}
              >
                <div className={`
                  w-4 h-4 border rounded flex items-center justify-center
                  ${isSelected 
                    ? 'bg-violet-600 border-violet-600' 
                    : 'border-gray-300 dark:border-gray-600'
                  }
                `}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                {option.icon}
                <span className="flex-1">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-gray-400 text-xs">{option.count}</span>
                )}
              </button>
            );
          })}
        </div>
      );

    case 'range':
      const [minVal, maxVal] = (value as [number, number]) || [filter.min || 0, filter.max || 100];
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Min</label>
              <input
                type="number"
                value={minVal}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                onChange={(e) => onChange([Number(e.target.value), maxVal])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Max</label>
              <input
                type="number"
                value={maxVal}
                min={filter.min}
                max={filter.max}
                step={filter.step}
                onChange={(e) => onChange([minVal, Number(e.target.value)])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(value === true ? null : true)}
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${value === true
                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }
            `}
          >
            Yes
          </button>
          <button
            onClick={() => onChange(value === false ? null : false)}
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${value === false
                ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }
            `}
          >
            No
          </button>
        </div>
      );

    case 'search':
      return (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={filter.placeholder || `Search ${filter.label}...`}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
      );

    case 'date':
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              onChange={(e) => {
                const dateVal = (value as [Date, Date]) || [null, null];
                onChange([new Date(e.target.value), dateVal[1]]);
              }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <span className="text-gray-400">to</span>
          <div className="flex-1 relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              onChange={(e) => {
                const dateVal = (value as [Date, Date]) || [null, null];
                onChange([dateVal[0], new Date(e.target.value)]);
              }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ============================================================================
// Filter Chips
// ============================================================================

interface FilterChipsProps {
  filters: FilterConfig[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset?: () => void;
  className?: string;
}

export function FilterChips({
  filters,
  values,
  onChange,
  onReset,
  className = '',
}: FilterChipsProps) {
  const activeFilters = useMemo(() => {
    return Object.entries(values)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '' && 
        !(Array.isArray(v) && v.length === 0))
      .map(([key, val]) => {
        const filter = filters.find(f => f.id === key);
        if (!filter) return null;

        let label = '';
        if (filter.type === 'select') {
          const option = filter.options?.find(o => o.value === val);
          label = option?.label || String(val);
        } else if (filter.type === 'multiselect') {
          const labels = (val as string[]).map(v => 
            filter.options?.find(o => o.value === v)?.label || v
          );
          label = labels.join(', ');
        } else if (filter.type === 'range') {
          label = `${(val as [number, number])[0]} - ${(val as [number, number])[1]}`;
        } else if (filter.type === 'boolean') {
          label = val ? 'Yes' : 'No';
        } else {
          label = String(val);
        }

        return { id: key, filterLabel: filter.label, label };
      })
      .filter(Boolean);
  }, [filters, values]);

  if (activeFilters.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {activeFilters.map(filter => filter && (
        <motion.div
          key={filter.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 rounded-full text-sm"
        >
          <span className="font-medium">{filter.filterLabel}:</span>
          <span>{filter.label}</span>
          <button
            onClick={() => onChange({ ...values, [filter.id]: null })}
            className="ml-1 p-0.5 hover:bg-violet-100 dark:hover:bg-violet-900 rounded-full"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      ))}
      {onReset && (
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Quick Filters
// ============================================================================

interface QuickFilter {
  id: string;
  label: string;
  icon?: React.ReactNode;
  values: FilterValue;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  activeFilter?: string;
  onChange: (values: FilterValue) => void;
  onSelect: (id: string) => void;
  className?: string;
}

export function QuickFilters({
  filters,
  activeFilter,
  onChange,
  onSelect,
  className = '',
}: QuickFiltersProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => {
            onSelect(filter.id);
            onChange(filter.values);
          }}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors
            ${activeFilter === filter.id
              ? 'bg-violet-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          {filter.icon}
          {filter.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// useFilters Hook
// ============================================================================

export function useFilters(initialValues: FilterValue = {}) {
  const [values, setValues] = useState<FilterValue>(initialValues);

  const setValue = useCallback((id: string, value: FilterValue[string]) => {
    setValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(values).some(v => 
      v !== null && v !== undefined && v !== '' && 
      !(Array.isArray(v) && v.length === 0)
    );
  }, [values]);

  return {
    values,
    setValues,
    setValue,
    reset,
    hasActiveFilters,
  };
}
