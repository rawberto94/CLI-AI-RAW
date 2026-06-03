'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SetStateAction } from 'react';
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
  Calendar as CalendarIcon,
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
  UserCircle,
  Coins,
  MapPin,
  CreditCard,
  FileStack,
  GitBranch,
  Crosshair,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { FilterState } from '@/lib/contracts/filter-state';
import type { SearchScope } from '@/hooks/use-contracts-page-filters';

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
  searchScope?: SearchScope;
  onSearchScopeChange?: (scope: SearchScope) => void;
  searchScopeLabel?: string;
  filterState: FilterState;
  onFilterStateChange: (value: SetStateAction<FilterState>) => void;
  suppliers: string[];
  categories: { id: string; name: string; color: string }[];
  clients: string[];
  contractTypes: string[];
  currencies: string[];
  jurisdictions: string[];
  paymentTerms: string[];
  tags: string[];
  accessScope: 'all' | 'mine';
  onAccessScopeChange: (scope: 'all' | 'mine') => void;
  onClearFilters: () => void;
  onAISearchClick?: (query: string) => void;
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
  { id: 'completed', label: 'Active', value: 'completed', color: 'violet' },
  { id: 'processing', label: 'Processing', value: 'processing', color: 'blue' },
  { id: 'uploaded', label: 'Uploaded', value: 'uploaded', color: 'amber' },
  { id: 'failed', label: 'Failed', value: 'failed', color: 'red' },
  { id: 'archived', label: 'Archived', value: 'archived', color: 'slate' },
];

const RISK_OPTIONS: FilterOption[] = [
  { id: 'low', label: 'Low Risk', value: 'low', icon: Shield, color: 'violet' },
  { id: 'medium', label: 'Medium Risk', value: 'medium', icon: Shield, color: 'amber' },
  { id: 'high', label: 'High Risk', value: 'high', icon: AlertTriangle, color: 'red' },
];

const EXPIRATION_OPTIONS: FilterOption[] = [
  { id: 'expired', label: 'Expired', value: 'expired', icon: TimerOff, color: 'red' },
  { id: 'expiring-7', label: 'Expiring in 7 days', value: 'expiring-7', icon: AlertTriangle, color: 'amber' },
  { id: 'expiring-30', label: 'Expiring in 30 days', value: 'expiring-30', icon: CalendarClock, color: 'yellow' },
  { id: 'expiring-90', label: 'Expiring in 90 days', value: 'expiring-90', icon: CalendarIcon, color: 'blue' },
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

const DOCUMENT_ROLE_OPTIONS: FilterOption[] = [
  { id: 'NEW_CONTRACT', label: 'New Contract', value: 'NEW_CONTRACT' },
  { id: 'EXISTING', label: 'Existing', value: 'EXISTING' },
  { id: 'AMENDMENT', label: 'Amendment', value: 'AMENDMENT' },
  { id: 'RENEWAL', label: 'Renewal', value: 'RENEWAL' },
];

const METADATA_ISSUE_OPTIONS: FilterOption[] = [
  { id: 'missing-title', label: 'Missing title', value: 'missing-title' },
  { id: 'missing-party', label: 'Missing counterparty', value: 'missing-party' },
  { id: 'missing-value', label: 'Missing value', value: 'missing-value' },
  { id: 'missing-dates', label: 'Missing key dates', value: 'missing-dates' },
  { id: 'missing-category', label: 'Missing category', value: 'missing-category' },
  { id: 'missing-tags', label: 'Missing tags', value: 'missing-tags' },
  { id: 'low-confidence', label: 'Low AI confidence', value: 'low-confidence' },
];

const SIGNATURE_OPTIONS: FilterOption[] = [
  { id: 'signed', label: 'Signed', value: 'signed', icon: Check, color: 'green' },
  { id: 'partially_signed', label: 'Partially Signed', value: 'partially_signed', icon: AlertTriangle, color: 'amber' },
  { id: 'unsigned', label: 'Unsigned', value: 'unsigned', icon: X, color: 'red' },
  { id: 'unknown', label: 'Unknown', value: 'unknown', icon: CircleDot, color: 'slate' },
];

const DOCUMENT_TYPE_OPTIONS: FilterOption[] = [
  { id: 'contract', label: 'Contract', value: 'contract' },
  { id: 'purchase_order', label: 'Purchase Order', value: 'purchase_order' },
  { id: 'invoice', label: 'Invoice', value: 'invoice' },
  { id: 'quote', label: 'Quote', value: 'quote' },
  { id: 'proposal', label: 'Proposal', value: 'proposal' },
  { id: 'amendment', label: 'Amendment', value: 'amendment' },
  { id: 'addendum', label: 'Addendum', value: 'addendum' },
];

const RELATIONSHIP_OPTIONS: FilterOption[] = [
  { id: 'SOW_UNDER_MSA', label: 'SOW (under MSA)', value: 'SOW_UNDER_MSA', color: 'blue' },
  { id: 'AMENDMENT', label: 'Amendment', value: 'AMENDMENT', color: 'amber' },
  { id: 'ADDENDUM', label: 'Addendum', value: 'ADDENDUM', color: 'purple' },
  { id: 'RENEWAL', label: 'Renewal', value: 'RENEWAL', color: 'emerald' },
  { id: 'CHANGE_ORDER', label: 'Change Order', value: 'CHANGE_ORDER', color: 'orange' },
];

const STORAGE_KEY = 'contracts-search-history';
const MAX_HISTORY = 8;

// ============================================================================
// Smart Search Input
// ============================================================================

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'title', label: 'Title' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'client', label: 'Client' },
  { value: 'type', label: 'Type' },
  { value: 'tags', label: 'Tags' },
  { value: 'jurisdiction', label: 'Jurisdiction' },
];

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  scopeLabel: string;
  onAIClick: (query: string) => void;
  placeholder?: string;
  suggestions: SearchSuggestion[];
  isSearching?: boolean;
}

const SmartSearchInput = memo(function SmartSearchInput({
  value,
  onChange,
  scope,
  onScopeChange,
  scopeLabel,
  onAIClick,
  placeholder = scope !== 'all' ? `Search in ${scopeLabel.toLowerCase()}...` : 'Search contracts, parties, terms...',
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
      case 'contract': return 'text-violet-500';
      case 'ai': return 'text-violet-500';
      case 'filter': return 'text-violet-500';
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
            ? "bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-purple-500/10 blur-xl scale-105" 
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

          {/* Search Scope Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border",
                  scope !== 'all'
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Crosshair className="h-3 w-3" />
                <span className="hidden sm:inline">{scopeLabel}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1 bg-white shadow-xl border-slate-200">
              <div className="space-y-0.5">
                {SEARCH_SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onScopeChange(option.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      scope === option.value
                        ? "bg-gradient-to-r from-slate-100 to-slate-50 font-medium"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                      scope === option.value
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 border-violet-500"
                        : "border-slate-300"
                    )}>
                      {scope === option.value && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-slate-700">{option.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
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
          <motion.div key="dropdown"
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
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-950/50 dark:hover:to-violet-950/50 transition-colors group"
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
      active: 'bg-violet-100 border-violet-300 text-violet-700 shadow-sm shadow-violet-200/50 dark:bg-violet-950/50 dark:border-violet-700 dark:text-violet-300',
      inactive: 'hover:bg-violet-50 hover:border-violet-200 dark:hover:bg-violet-950/30',
      badge: 'bg-gradient-to-r from-violet-500 to-purple-500',
    },
    blue: {
      active: 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm shadow-blue-200/50 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-300',
      inactive: 'hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950/30',
      badge: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    },
    emerald: {
      active: 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm shadow-emerald-200/50 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300',
      inactive: 'hover:bg-emerald-50 hover:border-emerald-200 dark:hover:bg-emerald-950/30',
      badge: 'bg-gradient-to-r from-emerald-500 to-green-500',
    },
    amber: {
      active: 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm shadow-amber-200/50 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300',
      inactive: 'hover:bg-amber-50 hover:border-amber-200 dark:hover:bg-amber-950/30',
      badge: 'bg-gradient-to-r from-amber-500 to-orange-500',
    },
    red: {
      active: 'bg-red-100 border-red-300 text-red-700 shadow-sm shadow-red-200/50 dark:bg-red-950/50 dark:border-red-700 dark:text-red-300',
      inactive: 'hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/30',
      badge: 'bg-gradient-to-r from-red-500 to-rose-500',
    },
    teal: {
      active: 'bg-teal-100 border-teal-300 text-teal-700 shadow-sm shadow-teal-200/50 dark:bg-teal-950/50 dark:border-teal-700 dark:text-teal-300',
      inactive: 'hover:bg-teal-50 hover:border-teal-200 dark:hover:bg-teal-950/30',
      badge: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    },
    slate: {
      active: 'bg-slate-200 border-slate-400 text-slate-700 shadow-sm shadow-slate-200/50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300',
      inactive: 'hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800/50',
      badge: 'bg-gradient-to-r from-slate-500 to-slate-600',
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.slate;

  if (children) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-200",
              isActive ? colors.active : `border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 ${colors.inactive}`,
              "hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span className={cn("min-w-[18px] h-[18px] rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-sm", colors.badge)}>
                {count}
              </span>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5 bg-white/95 backdrop-blur-sm shadow-xl border-slate-200">
          {children}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-200",
        isActive ? colors.active : `border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 ${colors.inactive}`,
        "hover:scale-[1.02] active:scale-[0.98]"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && (
        <span className={cn("min-w-[18px] h-[18px] rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-sm", colors.badge)}>
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
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
        isSelected 
          ? "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 shadow-sm" 
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
      <div className={cn(
        "w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all duration-200",
        isSelected 
          ? "bg-gradient-to-br from-violet-500 to-purple-600 border-violet-500 shadow-sm shadow-violet-500/30" 
          : "border-slate-300 dark:border-slate-600 hover:border-violet-300"
      )}>
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>
      {Icon && <Icon className={cn("h-4 w-4", {
        'text-slate-500': option.color === 'slate',
        'text-violet-500': option.color === 'violet',
        'text-blue-500': option.color === 'blue',
        'text-amber-500': option.color === 'amber',
        'text-red-500': option.color === 'red',
        'text-yellow-500': option.color === 'yellow',
        'text-green-500': option.color === 'green',
      })} />}
      <span className="flex-1 text-left text-slate-700 dark:text-slate-300 font-medium">{option.label}</span>
      {option.count !== undefined && (
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{option.count}</span>
      )}
    </button>
  );
});

// ============================================================================
// Searchable Filter List
// ============================================================================

interface SearchableFilterListProps {
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
}

const SearchableFilterList = memo(function SearchableFilterList({
  options,
  selectedValues,
  onToggle,
  searchPlaceholder = 'Search...',
}: SearchableFilterListProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  return (
    <div className="space-y-1">
      {options.length > 8 && (
        <div className="px-1.5 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>
        </div>
      )}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((option) => (
          <FilterOptionItem
            key={option.id}
            option={option}
            isSelected={selectedValues.includes(option.value)}
            onToggle={() => onToggle(option.value)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">
            No matches
          </div>
        )}
      </div>
    </div>
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
    violet: 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border-violet-200/60 shadow-sm shadow-violet-200/30 dark:from-violet-950/50 dark:to-purple-950/50 dark:text-violet-300 dark:border-violet-800',
    blue: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-blue-200/60 shadow-sm shadow-blue-200/30 dark:from-blue-950/50 dark:to-indigo-950/50 dark:text-blue-300 dark:border-blue-800',
    emerald: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200/60 shadow-sm shadow-emerald-200/30 dark:from-emerald-950/50 dark:to-green-950/50 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-amber-200/60 shadow-sm shadow-amber-200/30 dark:from-amber-950/50 dark:to-orange-950/50 dark:text-amber-300 dark:border-amber-800',
    red: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-red-200/60 shadow-sm shadow-red-200/30 dark:from-red-950/50 dark:to-rose-950/50 dark:text-red-300 dark:border-red-800',
    teal: 'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700 border-teal-200/60 shadow-sm shadow-teal-200/30 dark:from-teal-950/50 dark:to-cyan-950/50 dark:text-teal-300 dark:border-teal-800',
    slate: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border-slate-200/60 shadow-sm shadow-slate-200/30 dark:from-slate-800 dark:to-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800"
    >
      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Filters:</span>
      <AnimatePresence mode="popLayout">
        {filters.map((filter, idx) => (
          <motion.span
            key={filter.id}
            initial={{ opacity: 0, scale: 0.8, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -5 }}
            whileHover={{ scale: 1.02 }}
            transition={{ delay: idx * 0.02 }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
              colorClasses[filter.color] || colorClasses.slate
            )}
          >
            {filter.label}
            <button
              onClick={filter.onRemove}
              className="p-0.5 rounded-full hover:bg-black/15 dark:hover:bg-white/15 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClearAll}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 rounded-full transition-colors border border-red-200/50 dark:border-red-800/50"
      >
        <RotateCcw className="h-3 w-3" />
        Clear all
      </motion.button>
    </motion.div>
  );
});

// ============================================================================
// Inline Filter Summary
// ============================================================================

interface FilterSummaryProps {
  totalResults: number;
  filters: { label: string }[];
  onClick: () => void;
}

const FilterSummary = memo(function FilterSummary({
  totalResults,
  filters,
  onClick,
}: FilterSummaryProps) {
  if (filters.length === 0) {
    return (
      <button onClick={onClick} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
        {totalResults} contract{totalResults !== 1 ? 's' : ''}
      </button>
    );
  }

  const visible = filters.slice(0, 2);
  const remaining = filters.length - visible.length;

  return (
    <button onClick={onClick} className="text-xs text-slate-500 hover:text-slate-700 transition-colors text-left">
      <span className="font-medium text-slate-700">{totalResults} contract{totalResults !== 1 ? 's' : ''}</span>
      {' · filtered by: '}
      {visible.map((f, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <span className="font-medium text-slate-700">{f.label}</span>
        </span>
      ))}
      {remaining > 0 && (
        <span className="font-medium text-violet-600">, +{remaining}</span>
      )}
    </button>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const StateOfTheArtSearch = memo(function StateOfTheArtSearch({
  searchQuery,
  onSearchChange,
  searchScope,
  onSearchScopeChange,
  searchScopeLabel,
  filterState,
  onFilterStateChange,
  suppliers,
  categories,
  clients,
  contractTypes,
  currencies,
  jurisdictions,
  paymentTerms,
  tags,
  accessScope,
  onAccessScopeChange,
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
      recentSearches.slice(0, 4).forEach((search, i) => {
        items.push({
          id: `recent-${i}`,
          text: search,
          type: 'recent',
        });
      });

      items.push({
        id: 'filter-expiring',
        text: 'Contracts expiring soon',
        type: 'filter',
        icon: AlertTriangle,
        action: () => onFilterStateChange((prev) => ({
          ...prev,
          expirationFilters: ['expiring-30'],
        })),
      });
      items.push({
        id: 'filter-high-risk',
        text: 'High risk contracts',
        type: 'filter',
        icon: Shield,
        action: () => onFilterStateChange((prev) => ({
          ...prev,
          riskLevels: ['high'],
        })),
      });
    }

    return items;
  }, [searchQuery, recentSearches, onFilterStateChange]);

  // ── Toggle helpers ─────────────────────────────────────────────────
  const toggleArray = useCallback((key: keyof FilterState, value: string) => {
    onFilterStateChange((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      const updated = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: updated };
    });
  }, [onFilterStateChange]);

  const toggleSingle = useCallback((key: keyof FilterState, value: string | null) => {
    onFilterStateChange((prev) => ({ ...prev, [key]: value }));
  }, [onFilterStateChange]);

  const toggleStatus = useCallback((value: string) => {
    if (value === 'all') {
      onFilterStateChange((prev) => ({ ...prev, statuses: [] }));
      return;
    }
    toggleArray('statuses', value);
  }, [toggleArray, onFilterStateChange]);

  const toggleCategory = useCallback((value: string) => {
    onFilterStateChange((prev) => {
      const arr = prev.categories;
      const updated = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, categories: updated };
    });
  }, [onFilterStateChange]);

  // ── Build active filters for display ───────────────────────────────
  const activeFiltersDisplay = useMemo(() => {
    const filters: { id: string; label: string; color: string; onRemove: () => void }[] = [];

    if (searchQuery) {
      filters.push({
        id: 'search',
        label: scope !== 'all' ? `"${searchQuery}" in ${scopeLabel}` : `"${searchQuery}"`,
        color: 'slate',
        onRemove: () => onSearchChange(''),
      });
    }

    filterState.statuses.forEach((status) => {
      const option = STATUS_OPTIONS.find((s) => s.value === status);
      if (option) {
        filters.push({
          id: `status-${status}`,
          label: option.label,
          color: option.color || 'slate',
          onRemove: () => toggleArray('statuses', status),
        });
      }
    });

    filterState.documentRoles.forEach((role) => {
      const option = DOCUMENT_ROLE_OPTIONS.find((r) => r.value === role);
      filters.push({
        id: `role-${role}`,
        label: option?.label || role,
        color: 'blue',
        onRemove: () => toggleArray('documentRoles', role),
      });
    });

    filterState.riskLevels.forEach((risk) => {
      const option = RISK_OPTIONS.find((r) => r.value === risk);
      if (option) {
        filters.push({
          id: `risk-${risk}`,
          label: option.label,
          color: option.color || 'amber',
          onRemove: () => toggleArray('riskLevels', risk),
        });
      }
    });

    filterState.contractTypes.forEach((type) => {
      filters.push({
        id: `type-${type}`,
        label: type,
        color: 'blue',
        onRemove: () => toggleArray('contractTypes', type),
      });
    });

    filterState.expirationFilters.forEach((exp) => {
      const option = EXPIRATION_OPTIONS.find((e) => e.value === exp);
      if (option) {
        filters.push({
          id: `exp-${exp}`,
          label: option.label,
          color: option.color || 'amber',
          onRemove: () => toggleArray('expirationFilters', exp),
        });
      }
    });

    filterState.signatureFilters.forEach((sig) => {
      const option = SIGNATURE_OPTIONS.find((s) => s.value === sig);
      filters.push({
        id: `sig-${sig}`,
        label: option?.label || sig,
        color: 'emerald',
        onRemove: () => toggleArray('signatureFilters', sig),
      });
    });

    filterState.documentTypeFilters.forEach((dt) => {
      const option = DOCUMENT_TYPE_OPTIONS.find((d) => d.value === dt);
      filters.push({
        id: `doctype-${dt}`,
        label: option?.label || dt,
        color: 'slate',
        onRemove: () => toggleArray('documentTypeFilters', dt),
      });
    });

    filterState.relationshipType?.forEach((rt) => {
      const option = RELATIONSHIP_OPTIONS.find((r) => r.value === rt);
      filters.push({
        id: `rel-${rt}`,
        label: option?.label || rt,
        color: option?.color || 'blue',
        onRemove: () => toggleArray('relationshipType', rt),
      });
    });

    filterState.suppliers.forEach((supplier) => {
      filters.push({
        id: `supplier-${supplier}`,
        label: supplier,
        color: 'violet',
        onRemove: () => toggleArray('suppliers', supplier),
      });
    });

    filterState.clients.forEach((client) => {
      filters.push({
        id: `client-${client}`,
        label: client,
        color: 'purple',
        onRemove: () => toggleArray('clients', client),
      });
    });

    filterState.categories.forEach((category) => {
      const cat = categories.find((c) => c.id === category);
      filters.push({
        id: `category-${category}`,
        label: cat?.name || category,
        color: 'emerald',
        onRemove: () => toggleCategory(category),
      });
    });

    filterState.currencies.forEach((currency) => {
      filters.push({
        id: `currency-${currency}`,
        label: currency,
        color: 'teal',
        onRemove: () => toggleArray('currencies', currency),
      });
    });

    filterState.jurisdictions.forEach((jur) => {
      filters.push({
        id: `jur-${jur}`,
        label: jur,
        color: 'amber',
        onRemove: () => toggleArray('jurisdictions', jur),
      });
    });

    filterState.paymentTerms.forEach((pt) => {
      filters.push({
        id: `pt-${pt}`,
        label: pt,
        color: 'teal',
        onRemove: () => toggleArray('paymentTerms', pt),
      });
    });

    filterState.tags.forEach((tag) => {
      filters.push({
        id: `tag-${tag}`,
        label: tag,
        color: 'indigo',
        onRemove: () => toggleArray('tags', tag),
      });
    });

    filterState.metadataIssues.forEach((issue) => {
      const option = METADATA_ISSUE_OPTIONS.find((m) => m.value === issue);
      filters.push({
        id: `metadata-${issue}`,
        label: option?.label || issue,
        color: 'amber',
        onRemove: () => toggleArray('metadataIssues', issue),
      });
    });

    if (filterState.valueRangePreset) {
      const option = VALUE_RANGES.find((r) => r.value === filterState.valueRangePreset);
      if (option) {
        filters.push({
          id: `value-${filterState.valueRangePreset}`,
          label: option.label,
          color: 'amber',
          onRemove: () => toggleSingle('valueRangePreset', null),
        });
      }
    }

    if (filterState.dateRangePreset) {
      const option = DATE_PRESETS.find((r) => r.value === filterState.dateRangePreset);
      if (option) {
        filters.push({
          id: `date-${filterState.dateRangePreset}`,
          label: option.label,
          color: 'blue',
          onRemove: () => toggleSingle('dateRangePreset', null),
        });
      }
    }

    if (filterState.dateRange.from || filterState.dateRange.to) {
      const from = filterState.dateRange.from ? format(filterState.dateRange.from, 'MMM d') : '…';
      const to = filterState.dateRange.to ? format(filterState.dateRange.to, 'MMM d') : '…';
      filters.push({
        id: 'date-range',
        label: `${from} – ${to}`,
        color: 'blue',
        onRemove: () => onFilterStateChange((prev) => ({ ...prev, dateRange: {} })),
      });
    }

    if (filterState.valueRange.min > 0 || filterState.valueRange.max < 1000000) {
      const min = filterState.valueRange.min > 0 ? `$${(filterState.valueRange.min / 1000).toFixed(0)}K` : '$0';
      const max = filterState.valueRange.max < 1000000 ? `$${(filterState.valueRange.max / 1000).toFixed(0)}K` : '$1M+';
      filters.push({
        id: 'value-range',
        label: `${min} – ${max}`,
        color: 'amber',
        onRemove: () => onFilterStateChange((prev) => ({ ...prev, valueRange: { min: 0, max: 1000000 } })),
      });
    }

    if (filterState.hasDeadline === true) {
      filters.push({
        id: 'has-deadline',
        label: 'Has deadline',
        color: 'emerald',
        onRemove: () => onFilterStateChange((prev) => ({ ...prev, hasDeadline: null })),
      });
    }

    if (filterState.isExpiring === true) {
      filters.push({
        id: 'is-expiring',
        label: 'Expiring soon',
        color: 'red',
        onRemove: () => onFilterStateChange((prev) => ({ ...prev, isExpiring: null })),
      });
    }

    if (accessScope === 'mine') {
      filters.push({
        id: 'access-scope',
        label: 'My Contracts',
        color: 'slate',
        onRemove: () => onAccessScopeChange('all'),
      });
    }

    return filters;
  }, [
    searchQuery,
    searchScope,
    searchScopeLabel,
    filterState,
    categories,
    accessScope,
    onSearchChange,
    onAccessScopeChange,
    toggleArray,
    toggleSingle,
    toggleCategory,
    onFilterStateChange,
  ]);

  // ── Filter summary labels ──────────────────────────────────────────
  const filterSummaryLabels = useMemo(() => {
    return activeFiltersDisplay.map((f) => ({ label: f.label }));
  }, [activeFiltersDisplay]);

  const handleAISearch = useCallback(
    (query: string) => {
      saveToHistory(query);
      onAISearchClick?.(query);
    },
    [saveToHistory, onAISearchClick]
  );

  // ── Dynamic options to FilterOption arrays ─────────────────────────
  const supplierOptions: FilterOption[] = useMemo(
    () => suppliers.map((s) => ({ id: s, label: s, value: s })),
    [suppliers]
  );
  const clientOptions: FilterOption[] = useMemo(
    () => clients.map((c) => ({ id: c, label: c, value: c })),
    [clients]
  );
  const contractTypeOptions: FilterOption[] = useMemo(
    () => contractTypes.map((t) => ({ id: t, label: t, value: t })),
    [contractTypes]
  );
  const currencyOptions: FilterOption[] = useMemo(
    () => currencies.map((c) => ({ id: c, label: c, value: c })),
    [currencies]
  );
  const jurisdictionOptions: FilterOption[] = useMemo(
    () => jurisdictions.map((j) => ({ id: j, label: j, value: j })),
    [jurisdictions]
  );
  const paymentTermOptions: FilterOption[] = useMemo(
    () => paymentTerms.map((p) => ({ id: p, label: p, value: p })),
    [paymentTerms]
  );
  const tagOptions: FilterOption[] = useMemo(
    () => tags.map((t) => ({ id: t, label: t, value: t })),
    [tags]
  );

  return (
    <div className={cn("space-y-2 relative", className)}>
      {/* Loading shimmer overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div key="loading"
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
          scope={searchScope ?? 'all'}
          onScopeChange={onSearchScopeChange ?? (() => {})}
          scopeLabel={searchScopeLabel ?? 'All fields'}
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
          data-testid="filter-toggle-btn"
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

      {/* Inline Filter Summary */}
      <div className="flex items-center justify-between">
        <FilterSummary
          totalResults={totalResults}
          filters={filterSummaryLabels}
          onClick={() => setShowAdvanced((prev) => !prev)}
        />
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter Chips Row */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div key="advanced"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              {/* Status Row — now multi-select */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[60px]">Status</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map((status) => {
                    const isSelected = status.value === 'all'
                      ? filterState.statuses.length === 0
                      : filterState.statuses.includes(status.value);
                    const activeClasses: Record<string, string> = {
                      slate: 'bg-slate-100 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300 ring-2 ring-slate-500/30',
                      violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 ring-2 ring-violet-500/30',
                      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 ring-2 ring-blue-500/30',
                      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 ring-2 ring-amber-500/30',
                      red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 ring-2 ring-red-500/30',
                      emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 ring-2 ring-emerald-500/30',
                    };
                    const dotClasses: Record<string, string> = {
                      slate: 'bg-slate-400',
                      violet: 'bg-violet-500',
                      blue: 'bg-blue-500',
                      amber: 'bg-amber-500',
                      red: 'bg-red-500',
                      emerald: 'bg-emerald-500',
                    };
                    return (
                      <button
                        key={status.id}
                        onClick={() => toggleStatus(status.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                          isSelected
                            ? activeClasses[status.color ?? 'slate'] || activeClasses.slate
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                        )}
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          dotClasses[status.color ?? 'slate'] || 'bg-slate-400'
                        )} />
                        {status.label}
                      </button>
                    );
                  })}
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
                  count={filterState.riskLevels.length}
                  isActive={filterState.riskLevels.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {RISK_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.riskLevels.includes(option.value)}
                        onToggle={() => toggleArray('riskLevels', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Type Filter */}
                <FilterChip
                  label="Type"
                  icon={Tag}
                  color="blue"
                  count={filterState.contractTypes.length}
                  isActive={filterState.contractTypes.length > 0}
                  onClick={() => {}}
                >
                  <SearchableFilterList
                    options={CONTRACT_TYPES}
                    selectedValues={filterState.contractTypes}
                    onToggle={(value) => toggleArray('contractTypes', value)}
                    searchPlaceholder="Search types..."
                  />
                </FilterChip>

                {/* Expiration Filter */}
                <FilterChip
                  label="Expires"
                  icon={CalendarClock}
                  color="red"
                  count={filterState.expirationFilters.length}
                  isActive={filterState.expirationFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {EXPIRATION_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.expirationFilters.includes(option.value)}
                        onToggle={() => toggleArray('expirationFilters', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Signature Filter */}
                <FilterChip
                  label="Signature"
                  icon={Check}
                  color="emerald"
                  count={filterState.signatureFilters.length}
                  isActive={filterState.signatureFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {SIGNATURE_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.signatureFilters.includes(option.value)}
                        onToggle={() => toggleArray('signatureFilters', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Document Type Filter */}
                <FilterChip
                  label="Doc Type"
                  icon={FileText}
                  color="slate"
                  count={filterState.documentTypeFilters.length}
                  isActive={filterState.documentTypeFilters.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.documentTypeFilters.includes(option.value)}
                        onToggle={() => toggleArray('documentTypeFilters', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Relationship Type Filter */}
                <FilterChip
                  label="Relationship"
                  icon={GitBranch}
                  color="violet"
                  count={filterState.relationshipType?.length ?? 0}
                  isActive={(filterState.relationshipType?.length ?? 0) > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.relationshipType?.includes(option.value) ?? false}
                        onToggle={() => toggleArray('relationshipType', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Document Role Filter */}
                <FilterChip
                  label="Role"
                  icon={FileStack}
                  color="blue"
                  count={filterState.documentRoles.length}
                  isActive={filterState.documentRoles.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {DOCUMENT_ROLE_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.documentRoles.includes(option.value)}
                        onToggle={() => toggleArray('documentRoles', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Category Filter */}
                {categories.length > 0 && (
                  <FilterChip
                    label="Category"
                    icon={Hash}
                    color="emerald"
                    count={filterState.categories.length}
                    isActive={filterState.categories.length > 0}
                    onClick={() => {}}
                  >
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {categories.map((option) => (
                        <FilterOptionItem
                          key={option.id}
                          option={{ id: option.id, label: option.name, value: option.id }}
                          isSelected={filterState.categories.includes(option.id)}
                          onToggle={() => toggleCategory(option.id)}
                        />
                      ))}
                    </div>
                  </FilterChip>
                )}

                {/* Access Scope Toggle */}
                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => onAccessScopeChange('all')}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium transition-colors",
                      accessScope === 'all'
                        ? "bg-slate-800 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => onAccessScopeChange('mine')}
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 dark:border-slate-700",
                      accessScope === 'mine'
                        ? "bg-slate-800 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    Mine
                  </button>
                </div>

                {/* Supplier Filter */}
                {suppliers.length > 0 && (
                  <FilterChip
                    label="Supplier"
                    icon={Building2}
                    color="violet"
                    count={filterState.suppliers.length}
                    isActive={filterState.suppliers.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={supplierOptions}
                      selectedValues={filterState.suppliers}
                      onToggle={(value) => toggleArray('suppliers', value)}
                      searchPlaceholder="Search suppliers..."
                    />
                  </FilterChip>
                )}

                {/* Client Filter */}
                {clients.length > 0 && (
                  <FilterChip
                    label="Client"
                    icon={UserCircle}
                    color="purple"
                    count={filterState.clients.length}
                    isActive={filterState.clients.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={clientOptions}
                      selectedValues={filterState.clients}
                      onToggle={(value) => toggleArray('clients', value)}
                      searchPlaceholder="Search clients..."
                    />
                  </FilterChip>
                )}

                {/* Currency Filter */}
                {currencies.length > 0 && (
                  <FilterChip
                    label="Currency"
                    icon={Coins}
                    color="teal"
                    count={filterState.currencies.length}
                    isActive={filterState.currencies.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={currencyOptions}
                      selectedValues={filterState.currencies}
                      onToggle={(value) => toggleArray('currencies', value)}
                      searchPlaceholder="Search currencies..."
                    />
                  </FilterChip>
                )}

                {/* Jurisdiction Filter */}
                {jurisdictions.length > 0 && (
                  <FilterChip
                    label="Jurisdiction"
                    icon={MapPin}
                    color="amber"
                    count={filterState.jurisdictions.length}
                    isActive={filterState.jurisdictions.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={jurisdictionOptions}
                      selectedValues={filterState.jurisdictions}
                      onToggle={(value) => toggleArray('jurisdictions', value)}
                      searchPlaceholder="Search jurisdictions..."
                    />
                  </FilterChip>
                )}

                {/* Payment Terms Filter */}
                {paymentTerms.length > 0 && (
                  <FilterChip
                    label="Payment"
                    icon={CreditCard}
                    color="teal"
                    count={filterState.paymentTerms.length}
                    isActive={filterState.paymentTerms.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={paymentTermOptions}
                      selectedValues={filterState.paymentTerms}
                      onToggle={(value) => toggleArray('paymentTerms', value)}
                      searchPlaceholder="Search payment terms..."
                    />
                  </FilterChip>
                )}

                {/* Tags Filter */}
                {tags.length > 0 && (
                  <FilterChip
                    label="Tags"
                    icon={Tag}
                    color="indigo"
                    count={filterState.tags.length}
                    isActive={filterState.tags.length > 0}
                    onClick={() => {}}
                  >
                    <SearchableFilterList
                      options={tagOptions}
                      selectedValues={filterState.tags}
                      onToggle={(value) => toggleArray('tags', value)}
                      searchPlaceholder="Search tags..."
                    />
                  </FilterChip>
                )}

                {/* Metadata Issues Filter */}
                <FilterChip
                  label="Metadata"
                  icon={AlertTriangle}
                  color="amber"
                  count={filterState.metadataIssues.length}
                  isActive={filterState.metadataIssues.length > 0}
                  onClick={() => {}}
                >
                  <div className="space-y-0.5">
                    {METADATA_ISSUE_OPTIONS.map((option) => (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={filterState.metadataIssues.includes(option.value)}
                        onToggle={() => toggleArray('metadataIssues', option.value)}
                      />
                    ))}
                  </div>
                </FilterChip>

                {/* Value Range Filter */}
                <FilterChip
                  label="Value"
                  icon={DollarSign}
                  color="violet"
                  count={(filterState.valueRangePreset ? 1 : 0) + (filterState.valueRange.min > 0 || filterState.valueRange.max < 1000000 ? 1 : 0)}
                  isActive={!!filterState.valueRangePreset || filterState.valueRange.min > 0 || filterState.valueRange.max < 1000000}
                  onClick={() => {}}
                >
                  <div className="space-y-3 p-1">
                    <div className="space-y-0.5">
                      {VALUE_RANGES.map((option) => (
                        <FilterOptionItem
                          key={option.id}
                          option={option}
                          isSelected={filterState.valueRangePreset === option.value}
                          onToggle={() => toggleSingle('valueRangePreset',
                            filterState.valueRangePreset === option.value ? null : option.value
                          )}
                        />
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-medium text-slate-500">Custom range</div>
                      <Slider
                        min={0}
                        max={1000000}
                        step={10000}
                        value={[filterState.valueRange.min, filterState.valueRange.max]}
                        onValueChange={([min, max]) =>
                          onFilterStateChange((prev) => ({ ...prev, valueRange: { min, max } }))
                        }
                      />
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>${filterState.valueRange.min.toLocaleString()}</span>
                        <span>${filterState.valueRange.max === 1000000 ? '1M+' : filterState.valueRange.max.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </FilterChip>

                {/* Date Range Filter */}
                <FilterChip
                  label="Created"
                  icon={CalendarIcon}
                  color="violet"
                  count={(filterState.dateRangePreset ? 1 : 0) + (filterState.dateRange.from || filterState.dateRange.to ? 1 : 0)}
                  isActive={!!filterState.dateRangePreset || !!filterState.dateRange.from || !!filterState.dateRange.to}
                  onClick={() => {}}
                >
                  <div className="space-y-3 p-1">
                    <div className="space-y-0.5">
                      {DATE_PRESETS.map((option) => (
                        <FilterOptionItem
                          key={option.id}
                          option={option}
                          isSelected={filterState.dateRangePreset === option.value}
                          onToggle={() => toggleSingle('dateRangePreset',
                            filterState.dateRangePreset === option.value ? null : option.value
                          )}
                        />
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-medium text-slate-500">Custom range</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-xs font-normal">
                              <CalendarIcon className="mr-1.5 h-3 w-3" />
                              {filterState.dateRange.from ? format(filterState.dateRange.from, 'PP') : 'From'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={filterState.dateRange.from}
                              onSelect={(date) =>
                                onFilterStateChange((prev) => ({
                                  ...prev,
                                  dateRange: { ...prev.dateRange, from: date || undefined },
                                }))
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-xs font-normal">
                              <CalendarIcon className="mr-1.5 h-3 w-3" />
                              {filterState.dateRange.to ? format(filterState.dateRange.to, 'PP') : 'To'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={filterState.dateRange.to}
                              onSelect={(date) =>
                                onFilterStateChange((prev) => ({
                                  ...prev,
                                  dateRange: { ...prev.dateRange, to: date || undefined },
                                }))
                              }
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </FilterChip>

                {/* Quick Toggles */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onFilterStateChange((prev) => ({
                      ...prev,
                      hasDeadline: prev.hasDeadline === true ? null : true,
                    }))}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      filterState.hasDeadline === true
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <CalendarClock className="h-3 w-3" />
                    Has deadline
                  </button>
                  <button
                    onClick={() => onFilterStateChange((prev) => ({
                      ...prev,
                      isExpiring: prev.isExpiring === true ? null : true,
                    }))}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      filterState.isExpiring === true
                        ? "bg-red-100 border-red-300 text-red-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <TimerOff className="h-3 w-3" />
                    Expiring soon
                  </button>
                </div>
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
