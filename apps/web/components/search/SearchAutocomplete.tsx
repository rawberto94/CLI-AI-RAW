'use client';

/**
 * Search Autocomplete
 * Smart search with suggestions, recent searches, and keyboard navigation
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  TrendingUp,
  FileText,
  X,
  ArrowRight,
  Sparkles,
  Hash,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'trending' | 'suggestion' | 'contract';
  icon?: LucideIcon;
  meta?: string;
}

interface SearchAutocompleteProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  suggestions?: SearchSuggestion[];
  recentSearches?: string[];
  onClearRecent?: () => void;
  isLoading?: boolean;
  className?: string;
  autoFocus?: boolean;
}

// ============================================================================
// Default Data
// ============================================================================

const DEFAULT_TRENDING: SearchSuggestion[] = [
  { id: 't1', text: 'Service agreements', type: 'trending' },
  { id: 't2', text: 'NDA templates', type: 'trending' },
  { id: 't3', text: 'Expiring this month', type: 'trending' },
];

// ============================================================================
// Type Icons
// ============================================================================

const TYPE_ICONS: Record<SearchSuggestion['type'], LucideIcon> = {
  recent: Clock,
  trending: TrendingUp,
  suggestion: Sparkles,
  contract: FileText,
};

const TYPE_LABELS: Record<SearchSuggestion['type'], string> = {
  recent: 'Recent',
  trending: 'Trending',
  suggestion: 'Suggestions',
  contract: 'Contracts',
};

// ============================================================================
// Component
// ============================================================================

export function SearchAutocomplete({
  placeholder = 'Search contracts...',
  onSearch,
  onSuggestionSelect,
  suggestions = [],
  recentSearches = [],
  onClearRecent,
  isLoading = false,
  className,
  autoFocus = false,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build suggestion list
  const allSuggestions = useMemo(() => {
    if (query.trim()) {
      return suggestions;
    }
    
    const items: SearchSuggestion[] = [];
    
    // Add recent searches
    recentSearches.slice(0, 3).forEach((text, i) => {
      items.push({ id: `recent-${i}`, text, type: 'recent' });
    });
    
    // Add trending
    items.push(...DEFAULT_TRENDING);
    
    return items;
  }, [query, suggestions, recentSearches]);

  // Group suggestions by type
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, SearchSuggestion[]> = {};
    allSuggestions.forEach((s) => {
      if (!groups[s.type]) groups[s.type] = [];
      groups[s.type]!.push(s);
    });
    return groups;
  }, [allSuggestions]);

  // Flatten for keyboard navigation
  const flatSuggestions = useMemo(() => 
    Object.values(groupedSuggestions).flat(),
    [groupedSuggestions]
  );

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [allSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatSuggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && flatSuggestions[selectedIndex]) {
          handleSelect(flatSuggestions[selectedIndex]);
        } else if (query.trim()) {
          onSearch(query.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [flatSuggestions, selectedIndex, query, onSearch]);

  const handleSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setIsOpen(false);
    onSuggestionSelect?.(suggestion);
    onSearch(suggestion.text);
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full h-12 pl-12 pr-12 text-sm text-slate-900',
            'bg-white border border-slate-200 rounded-xl',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-indigo-400',
            'transition-all duration-200'
          )}
        />
        
        {/* Loading / Clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading && (
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-purple-600 rounded-full animate-spin" />
          )}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-slate-400 bg-slate-100 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && flatSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="max-h-[400px] overflow-y-auto py-2">
              {Object.entries(groupedSuggestions).map(([type, items]) => (
                <div key={type}>
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {TYPE_LABELS[type as SearchSuggestion['type']]}
                    </span>
                    {type === 'recent' && onClearRecent && (
                      <button
                        onClick={onClearRecent}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {/* Items */}
                  {items.map((suggestion) => {
                    const globalIndex = flatSuggestions.indexOf(suggestion);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = suggestion.icon || TYPE_ICONS[suggestion.type];
                    
                    return (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSelect(suggestion)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                          'transition-colors duration-75',
                          isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <Icon className={cn(
                          'w-4 h-4 flex-shrink-0',
                          isSelected ? 'text-purple-500' : 'text-slate-400'
                        )} />
                        <span className={cn(
                          'flex-1 text-sm truncate',
                          isSelected ? 'text-indigo-900 font-medium' : 'text-slate-700'
                        )}>
                          {suggestion.text}
                        </span>
                        {suggestion.meta && (
                          <span className="text-xs text-slate-400">
                            {suggestion.meta}
                          </span>
                        )}
                        {isSelected && (
                          <ArrowRight className="w-4 h-4 text-indigo-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Inline Search (for headers/toolbars)
// ============================================================================

interface InlineSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineSearch({ value, onChange, placeholder = 'Search...', className }: InlineSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn(
      'relative flex items-center transition-all duration-200',
      isFocused ? 'w-64' : 'w-48',
      className
    )}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn(
          'w-full h-9 pl-9 pr-3 text-sm text-slate-700',
          'bg-slate-100 border-0 rounded-lg',
          'placeholder:text-slate-400',
          'focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500/20',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Filter Tags
// ============================================================================

interface FilterTag {
  id: string;
  label: string;
  value: string;
}

interface FilterTagsProps {
  tags: FilterTag[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}

export function FilterTags({ tags, onRemove, onClearAll }: FilterTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((tag) => (
        <motion.div
          key={tag.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm"
        >
          <span className="text-indigo-400 text-xs">{tag.label}:</span>
          <span className="font-medium">{tag.value}</span>
          <button
            onClick={() => onRemove(tag.id)}
            className="ml-0.5 p-0.5 text-indigo-400 hover:text-purple-600 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      ))}
      {onClearAll && tags.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
