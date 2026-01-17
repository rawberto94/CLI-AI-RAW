'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Filter,
  Sparkles,
  Clock,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  Check,
  Shield,
  Tag,
  CalendarClock,
  Building2,
  DollarSign,
  AlertTriangle,
  TimerOff,
  Calendar,
  CircleDot,
  Loader2,
  Command,
  Hash,
  FileText,
  Sliders,
  RotateCcw,
  Star,
  Bookmark,
  MessageSquare,
  Zap,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  id: string;
  label: string;
  value: string;
  icon?: React.ElementType;
  color?: string;
  count?: number;
}

interface FilterGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  options: FilterOption[];
  multiSelect?: boolean;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'trending' | 'contract' | 'ai' | 'filter';
  icon?: React.ElementType;
  action?: () => void;
}

interface StateOfTheArtSearchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  riskFilters: string[];
  onRiskFiltersChange: (values: string[]) => void;
  typeFilters: string[];
  onTypeFiltersChange: (values: string[]) => void;
  expirationFilters: string[];
  onExpirationFiltersChange: (values: string[]) => void;
  supplierFilters: string[];
  onSupplierFiltersChange: (values: string[]) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
  valueRangeFilter: string | null;
  onValueRangeFilterChange: (value: string | null) => void;
  dateRangeFilter: string | null;
  onDateRangeFilterChange: (value: string | null) => void;
  suppliers: string[];
  categories: { id: string; name: string; color: string }[];
  onClearFilters: () => void;
  onAISearchClick: (query: string) => void;
  activeFilterCount: number;
  totalResults: number;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Filter Configuration
// ============================================================================

const STATUS_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Statuses', value: 'all', color: 'slate' },
  { id: 'completed', label: 'Active', value: 'completed', color: 'emerald' },
  { id: 'processing', label: 'Processing', value: 'processing', color: 'blue' },
  { id: 'pending', label: 'Pending', value: 'pending', color: 'amber' },
  { id: 'failed', label: 'Failed', value: 'failed', color: 'red' },
];

const RISK_OPTIONS: FilterOption[] = [
  { id: 'low', label: 'Low Risk', value: 'low', icon: Shield, color: 'emerald' },
  { id: 'medium', label: 'Medium Risk', value: 'medium', icon: Shield, color: 'amber' },
  { id: 'high', label: 'High Risk', value: 'high', icon: AlertTriangle, color: 'red' },
];

const EXPIRATION_OPTIONS: FilterOption[] = [
  { id: 'expired', label: 'Expired', value: 'expired', icon: TimerOff, color: 'red' },
  { id: 'expiring-7', label: 'Expiring in 7 days', value: 'expiring-7', icon: AlertTriangle, color: 'amber' },
  { id: 'expiring-30', label: 'Expiring in 30 days', value: 'expiring-30', icon: CalendarClock, color: 'yellow' },
  { id: 'expiring-90', label: 'Expiring in 90 days', value: 'expiring-90', icon: Calendar, color: 'blue' },
  { id: 'no-expiry', label: 'No Expiration', value: 'no-expiry', icon: CircleDot, color: 'slate' },
];

const CONTRACT_TYPES: FilterOption[] = [
  { id: 'service', label: 'Service Agreement', value: 'Service Agreement' },
  { id: 'nda', label: 'NDA', value: 'NDA' },
  { id: 'employment', label: 'Employment', value: 'Employment' },
  { id: 'lease', label: 'Lease', value: 'Lease' },
  { id: 'vendor', label: 'Vendor Agreement', value: 'Vendor Agreement' },
  { id: 'consulting', label: 'Consulting', value: 'Consulting' },
  { id: 'license', label: 'License', value: 'License' },
  { id: 'partnership', label: 'Partnership', value: 'Partnership' },
];

const VALUE_RANGES: FilterOption[] = [
  { id: 'under10k', label: 'Under $10K', value: 'under10k' },
  { id: '10k-50k', label: '$10K - $50K', value: '10k-50k' },
  { id: '50k-100k', label: '$50K - $100K', value: '50k-100k' },
  { id: '100k-500k', label: '$100K - $500K', value: '100k-500k' },
  { id: 'over500k', label: 'Over $500K', value: 'over500k' },
];

const DATE_PRESETS: FilterOption[] = [
  { id: 'today', label: 'Today', value: 'today' },
  { id: 'week', label: 'This Week', value: 'week' },
  { id: 'month', label: 'This Month', value: 'month' },
  { id: 'quarter', label: 'This Quarter', value: 'quarter' },
  { id: 'year', label: 'This Year', value: 'year' },
];

const STORAGE_KEY = 'contracts-search-history';
const MAX_HISTORY = 8;

// ============================================================================
// Smart Search Input
// ============================================================================

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onAIClick: (query: string) => void;
  placeholder?: string;
  suggestions: SearchSuggestion[];
  isSearching?: boolean;
}

const SmartSearchInput = memo(function SmartSearchInput({
  value,
  onChange,
  onAIClick,
  placeholder = 'Search contracts, parties, terms...',
  suggestions,
  isSearching = false,
}: SmartSearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showDropdown = isFocused && (suggestions.length > 0 || value.length > 0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        if (e.key === 'Enter' && value) {
          onAIClick(value);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
            const suggestion = suggestions[highlightedIndex];
            if (suggestion.action) {
              suggestion.action();
            } else {
              onChange(suggestion.text);
            }
            setIsFocused(false);
          } else if (value) {
            onAIClick(value);
          }
          break;
        case 'Escape':
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, highlightedIndex, suggestions, value, onChange, onAIClick]
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value, isFocused]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'recent': return History;
      case 'trending': return TrendingUp;
      case 'contract': return FileText;
      case 'ai': return Sparkles;
      case 'filter': return Filter;
      default: return Search;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'recent': return 'text-slate-400';
      case 'trending': return 'text-amber-500';
      case 'contract': return 'text-blue-500';
      case 'ai': return 'text-violet-500';
      case 'filter': return 'text-emerald-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="relative flex-1">
      {/* Search Input */}
      <div className="relative group">
        <div className={cn(
          "absolute inset-0 rounded-xl transition-all duration-300",
          isFocused 
            ? "bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 blur-xl scale-105" 
            : "bg-transparent"
        )} />
        <div className={cn(
          "relative flex items-center gap-2 px-3 h-10 rounded-lg border-2 transition-all duration-200 bg-white dark:bg-slate-900",
          isFocused 
            ? "border-violet-400 dark:border-violet-500 shadow-lg shadow-violet-500/10" 
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        )}>
          <Search className={cn(
            "h-4 w-4 transition-colors",
            isFocused ? "text-violet-500" : "text-slate-400"
          )} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            data-testid="contract-search"
          />
          
          {isSearching && (
            <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
          )}
          
          {value && !isSearching && (
            <button
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
          
          {!value && (
            <div className="hidden sm:flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                <Command className="h-2.5 w-2.5 inline-block" />
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                K
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            {/* AI Search Option */}
            {value && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => onAIClick(value)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-950/50 dark:hover:to-purple-950/50 transition-colors group"
                >
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-md">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Ask AI: &quot;{value}&quot;
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Natural language search with AI assistance
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="max-h-64 overflow-y-auto py-2">
                {suggestions.map((suggestion, idx) => {
                  const Icon = suggestion.icon || getIconForType(suggestion.type);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <motion.button
                      key={suggestion.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => {
                        if (suggestion.action) {
                          suggestion.action();
                        } else {
                          onChange(suggestion.text);
                        }
                        setIsFocused(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isHighlighted
                          ? "bg-violet-50 dark:bg-violet-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", getColorForType(suggestion.type))} />
                      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
                        {suggestion.text}
                      </span>
                      {suggestion.type === 'ai' && (
                        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-[10px] px-1.5 py-0">
                          AI
                        </Badge>
                      )}
                      <ArrowRight
                        className={cn(
                          "h-3.5 w-3.5 text-slate-400 transition-opacity",
                          isHighlighted ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Keyboard Hints */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">Esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================================================
// Filter Chip
// ============================================================================

interface FilterChipProps {
  label: string;
  icon: React.ElementType;
  color: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

const FilterChip = memo(function FilterChip({
  label,
  icon: Icon,
  color,
  count,
  isActive,
  onClick,
  children,
}: FilterChipProps) {
  const colorClasses = {
    violet: {
      active: 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-950/50 dark:border-violet-700 dark:text-violet-300',
      inactive: 'hover:bg-violet-50 dark:hover:bg-violet-950/30',
      badge: 'bg-violet-500',
    },
    blue: {
      active: 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-300',
      inactive: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
      badge: 'bg-blue-500',
    },
    emerald: {
      active: 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300',
      inactive: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
      badge: 'bg-emerald-500',
    },
    amber: {
      active: 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300',
      inactive: 'hover:bg-amber-50 dark:hover:bg-amber-950/30',
      badge: 'bg-amber-500',
    },
    red: {
      active: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-950/50 dark:border-red-700 dark:text-red-300',
      inactive: 'hover:bg-red-50 dark:hover:bg-red-950/30',
      badge: 'bg-red-500',
    },
    teal: {
      active: 'bg-teal-100 border-teal-300 text-teal-700 dark:bg-teal-950/50 dark:border-teal-700 dark:text-teal-300',
      inactive: 'hover:bg-teal-50 dark:hover:bg-teal-950/30',
      badge: 'bg-teal-500',
    },
    slate: {
      active: 'bg-slate-200 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300',
      inactive: 'hover:bg-slate-100 dark:hover:bg-slate-800/50',
      badge: 'bg-slate-500',
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.slate;

  if (children) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              isActive ? colors.active : `border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 ${colors.inactive}`
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span className={cn("min-w-[18px] h-[18px] rounded-full text-white text-[10px] flex items-center justify-center font-semibold", colors.badge)}>
                {count}
              </span>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1">
          {children}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
        isActive ? colors.active : `border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 ${colors.inactive}`
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && (
        <span className={cn("min-w-[18px] h-[18px] rounded-full text-white text-[10px] flex items-center justify-center font-semibold", colors.badge)}>
          {count}
        </span>
      )}
    </button>
  );
});

// ============================================================================
// Filter Option Item
// ============================================================================

interface FilterOptionItemProps {
  option: FilterOption;
  isSelected: boolean;
  onToggle: () => void;
}

const FilterOptionItem = memo(function FilterOptionItem({
  option,
  isSelected,
  onToggle,
}: FilterOptionItemProps) {
  const Icon = option.icon;
  
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
        isSelected 
          ? "bg-slate-100 dark:bg-slate-800" 
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
        isSelected 
          ? "bg-violet-500 border-violet-500" 
          : "border-slate-300 dark:border-slate-600"
      )}>
        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      {Icon && <Icon className={cn("h-4 w-4", `text-${option.color}-500`)} />}
      <span className="flex-1 text-left text-slate-700 dark:text-slate-300">{option.label}</span>
      {option.count !== undefined && (
        <span className="text-xs text-slate-400">{option.count}</span>
      )}
    </button>
  );
});

// ============================================================================
// Active Filters Display
// ============================================================================

interface ActiveFiltersProps {
  filters: { id: string; label: string; color: string; onRemove: () => void }[];
  onClearAll: () => void;
}

const ActiveFilters = memo(function ActiveFilters({
  filters,
  onClearAll,
}: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
    blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
    teal: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active filters:</span>
      <AnimatePresence mode="popLayout">
        {filters.map((filter, idx) => (
          <motion.span
            key={filter.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: idx * 0.02 }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
              colorClasses[filter.color] || colorClasses.slate
            )}
          >
            {filter.label}
            <button
              onClick={filter.onRemove}
              className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <button
        onClick={onClearAll}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Clear all
      </button>
    </motion.div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const StateOfTheArtSearch = memo(function StateOfTheArtSearch({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  riskFilters,
  onRiskFiltersChange,
  typeFilters,
  onTypeFiltersChange,
  expirationFilters,
  onExpirationFiltersChange,
  supplierFilters,
  onSupplierFiltersChange,
  categoryFilter,
  onCategoryFilterChange,
  valueRangeFilter,
  onValueRangeFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  suppliers,
  categories,
  onClearFilters,
  onAISearchClick,
  activeFilterCount,
  totalResults,
  isLoading = false,
  className = '',
}: StateOfTheArtSearchProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Failed to load search history - silently handle
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Failed to save search history - silently handle
      }
      return updated;
    });
  }, []);

  // Build suggestions
  const suggestions = useMemo(() => {
    const items: SearchSuggestion[] = [];

    if (!searchQuery) {
      // Recent searches
      recentSearches.slice(0, 4).forEach((search, i) => {
        items.push({
          id: `recent-${i}`,
          text: search,
          type: 'recent',
        });
      });

      // Quick filters as suggestions
      items.push({
        id: 'filter-expiring',
        text: 'Contracts expiring soon',
        type: 'filter',
        icon: AlertTriangle,
        action: () => onExpirationFiltersChange(['expiring-30']),
      });
      items.push({
        id: 'filter-high-risk',
        text: 'High risk contracts',
        type: 'filter',
        icon: Shield,
        action: () => onRiskFiltersChange(['high']),
      });
    }

    return items;
  }, [searchQuery, recentSearches, onExpirationFiltersChange, onRiskFiltersChange]);

  // Build active filters for display
  const activeFiltersDisplay = useMemo(() => {
    const filters: { id: string; label: string; color: string; onRemove: () => void }[] = [];

    if (searchQuery) {
      filters.push({
        id: 'search',
        label: `"${searchQuery}"`,
        color: 'slate',
        onRemove: () => onSearchChange(''),
      });
    }

    if (statusFilter !== 'all') {
      const status = STATUS_OPTIONS.find((s) => s.value === statusFilter);
      if (status) {
        filters.push({
          id: 'status',
          label: status.label,
          color: status.color || 'slate',
          onRemove: () => onStatusChange('all'),
        });
      }
    }

    riskFilters.forEach((risk) => {
      const option = RISK_OPTIONS.find((r) => r.value === risk);
      if (option) {
        filters.push({
          id: `risk-${risk}`,
          label: option.label,
          color: option.color || 'amber',
          onRemove: () => onRiskFiltersChange(riskFilters.filter((r) => r !== risk)),
        });
      }
    });

    typeFilters.forEach((type) => {
      filters.push({
        id: `type-${type}`,
        label: type,
        color: 'blue',
        onRemove: () => onTypeFiltersChange(typeFilters.filter((t) => t !== type)),
      });
    });

    expirationFilters.forEach((exp) => {
      const option = EXPIRATION_OPTIONS.find((e) => e.value === exp);
      if (option) {
        filters.push({
          id: `exp-${exp}`,
          label: option.label,
          color: option.color || 'amber',
          onRemove: () => onExpirationFiltersChange(expirationFilters.filter((e) => e !== exp)),
        });
      }
    });

    return filters;
  }, [
    searchQuery,
    statusFilter,
    riskFilters,
    typeFilters,
    expirationFilters,
    onSearchChange,
    onStatusChange,
    onRiskFiltersChange,
    onTypeFiltersChange,
    onExpirationFiltersChange,
  ]);

  const handleAISearch = useCallback(
    (query: string) => {
      saveToHistory(query);
      onAISearchClick(query);
    },
    [saveToHistory, onAISearchClick]
  );

  const toggleRisk = useCallback(
    (value: string) => {
      onRiskFiltersChange(
        riskFilters.includes(value)
          ? riskFilters.filter((r) => r !== value)
          : [...riskFilters, value]
      );
    },
    [riskFilters, onRiskFiltersChange]
  );

  const toggleType = useCallback(
    (value: string) => {
      onTypeFiltersChange(
        typeFilters.includes(value)
          ? typeFilters.filter((t) => t !== value)
          : [...typeFilters, value]
      );
    },
    [typeFilters, onTypeFiltersChange]
  );

  const toggleExpiration = useCallback(
    (value: string) => {
      onExpirationFiltersChange(
        expirationFilters.includes(value)
          ? expirationFilters.filter((e) => e !== value)
          : [...expirationFilters, value]
      );
    },
    [expirationFilters, onExpirationFiltersChange]
  );

  const toggleSupplier = useCallback(
    (value: string) => {
      onSupplierFiltersChange(
        supplierFilters.includes(value)
          ? supplierFilters.filter((s) => s !== value)
          : [...supplierFilters, value]
      );
    },
    [supplierFilters, onSupplierFiltersChange]
  );

  return (
    <div className={cn("space-y-2 relative", className)}>
      {/* Loading shimmer overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-slate-800/60 animate-shimmer" 
              style={{
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Search Row */}
      <div className="flex flex-col lg:flex-row gap-2">
        {/* Search Input */}
        <SmartSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          onAIClick={handleAISearch}
          suggestions={suggestions}
          isSearching={isLoading}
        />

        {/* AI Button */}
        <Button
          onClick={() => handleAISearch(searchQuery || 'Help me find contracts')}
          className="h-10 gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium rounded-lg px-3 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-200"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-sm">Ask AI</span>
        </Button>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "h-10 gap-1.5 rounded-lg px-3 font-medium transition-all duration-200",
            showAdvanced
              ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          )}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-sm">Filters</span>
          {activeFilterCount > 0 && (
            <span className={cn(
              "min-w-[20px] h-[20px] rounded-full text-xs flex items-center justify-center font-semibold",
              showAdvanced 
                ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-white" 
                : "bg-violet-500 text-white"
            )}>
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Chips Row */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
              {/* Status Row */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[60px]">Status</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => onStatusChange(status.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                        statusFilter === status.value
                          ? `bg-${status.color}-100 text-${status.color}-700 dark:bg-${status.color}-950/50 dark:text-${status.color}-300 ring-2 ring-${status.color}-500/30`
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        status.color === 'slate' && "bg-slate-400",
                        status.color === 'emerald' && "bg-emerald-500",
                        status.color === 'blue' && "bg-blue-500",
                        status.color === 'amber' && "bg-amber-500",
                        status.color === 'red' && "bg-red-500"
                      )} />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[60px]">Filters</span>
                
                {/* Risk Filter */}
                <FilterChip
                  label="Risk"
                  icon={Shield}
                  color="amber"
                  count={riskFilters.length}
                  isActive={riskFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {RISK_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={riskFilters.includes(option.value)}
                        onToggle={() => toggleRisk(option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Type Filter */}
                <FilterChip
                  label="Type"
                  icon={Tag}
                  color="blue"
                  count={typeFilters.length}
                  isActive={typeFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {CONTRACT_TYPES.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={typeFilters.includes(option.value)}
                        onToggle={() => toggleType(option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Expiration Filter */}
                <FilterChip
                  label="Expires"
                  icon={CalendarClock}
                  color="red"
                  count={expirationFilters.length}
                  isActive={expirationFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {EXPIRATION_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={expirationFilters.includes(option.value)}
                        onToggle={() => toggleExpiration(option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Supplier Filter */}
                {suppliers.length > 0 && (
                  <FilterChip
                    label="Supplier"
                    icon={Building2}
                    color="teal"
                    count={supplierFilters.length}
                    isActive={supplierFilters.length > 0}
                    onClick={() => {}}
                  >
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {suppliers.map((supplier) => (
                        <FilterOptionItem
                          key={supplier}
                          option={{ id: supplier, label: supplier, value: supplier }}
                          isSelected={supplierFilters.includes(supplier)}
                          onToggle={() => toggleSupplier(supplier)}
                        />
                      ))}
                    </div>
                  </FilterChip>
                )}

                {/* Value Range Filter */}
                <FilterChip
                  label="Value"
                  icon={DollarSign}
                  color="emerald"
                  count={valueRangeFilter ? 1 : 0}
                  isActive={!!valueRangeFilter}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {VALUE_RANGES.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={valueRangeFilter === option.value}
                        onToggle={() => onValueRangeFilterChange(
                          valueRangeFilter === option.value ? null : option.value
                        )}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Date Range Filter */}
                <FilterChip
                  label="Created"
                  icon={Calendar}
                  color="violet"
                  count={dateRangeFilter ? 1 : 0}
                  isActive={!!dateRangeFilter}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {DATE_PRESETS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={dateRangeFilter === option.value}
                        onToggle={() => onDateRangeFilterChange(
                          dateRangeFilter === option.value ? null : option.value
                        )}
                      />
                    ))}
                  </div>
                </FilterChip>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filters */}
      {activeFiltersDisplay.length > 0 && (
        <ActiveFilters
          filters={activeFiltersDisplay}
          onClearAll={onClearFilters}
        />
      )}
    </div>
  );
});

export default StateOfTheArtSearch;
