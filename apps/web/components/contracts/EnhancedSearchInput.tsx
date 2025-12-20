'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  TrendingUp,
  X,
  ArrowRight,
  Hash,
  FileText,
  Building2,
  Tag,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'contracts-recent-searches';
const MAX_RECENT_SEARCHES = 5;

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'trending' | 'contract' | 'party' | 'category';
  icon?: React.ElementType;
}

interface EnhancedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
  suggestions?: SearchSuggestion[];
  showRecent?: boolean;
  showTrending?: boolean;
  trendingSearches?: string[];
}

const suggestionIcons: Record<string, React.ElementType> = {
  recent: Clock,
  trending: TrendingUp,
  contract: FileText,
  party: Building2,
  category: Tag,
};

export const EnhancedSearchInput = memo(function EnhancedSearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search contracts...',
  className = '',
  suggestions = [],
  showRecent = true,
  showTrending = true,
  trendingSearches = ['NDA', 'Service Agreement', 'Microsoft', 'Expiring soon'],
}: EnhancedSearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent searches:', e);
    }
  }, []);

  // Save search to recent
  const saveToRecent = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== searchTerm.toLowerCase());
      const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent searches:', e);
      }
      return updated;
    });
  }, []);

  // Clear recent searches
  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear recent searches:', e);
    }
  }, []);

  // Remove single recent search
  const removeRecent = useCallback((searchTerm: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== searchTerm);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to remove recent search:', e);
      }
      return updated;
    });
  }, []);

  // Build suggestions list
  const allSuggestions: SearchSuggestion[] = [
    // Recent searches
    ...(showRecent && !value
      ? recentSearches.map((text, i) => ({
          id: `recent-${i}`,
          text,
          type: 'recent' as const,
        }))
      : []),
    // Trending
    ...(showTrending && !value
      ? trendingSearches.map((text, i) => ({
          id: `trending-${i}`,
          text,
          type: 'trending' as const,
        }))
      : []),
    // Custom suggestions (filtered by current value)
    ...suggestions.filter((s) =>
      value ? s.text.toLowerCase().includes(value.toLowerCase()) : true
    ),
  ];

  const showDropdown = isFocused && allSuggestions.length > 0;

  // Handle search submission
  const handleSearch = useCallback(
    (searchTerm: string) => {
      if (searchTerm.trim()) {
        saveToRecent(searchTerm);
        onSearch?.(searchTerm);
      }
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [saveToRecent, onSearch]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: SearchSuggestion) => {
      onChange(suggestion.text);
      handleSearch(suggestion.text);
    },
    [onChange, handleSearch]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) {
        if (e.key === 'Enter') {
          handleSearch(value);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < allSuggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : allSuggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            handleSuggestionClick(allSuggestions[highlightedIndex]);
          } else {
            handleSearch(value);
          }
          break;
        case 'Escape':
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, highlightedIndex, allSuggestions, handleSuggestionClick, handleSearch, value]
  );

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value, isFocused]);

  // Click outside to close
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

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'pl-10 pr-10 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
            'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'transition-all duration-200'
          )}
          data-testid="contract-search"
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4 text-slate-400" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            {/* Recent Searches Header */}
            {showRecent && recentSearches.length > 0 && !value && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Recent
                </span>
                <button
                  onClick={clearRecent}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Trending Header */}
            {showTrending && trendingSearches.length > 0 && recentSearches.length === 0 && !value && (
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Trending
                </span>
              </div>
            )}

            {/* Suggestions List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {allSuggestions.map((suggestion, idx) => {
                const Icon = suggestion.icon || suggestionIcons[suggestion.type];
                const isHighlighted = idx === highlightedIndex;

                return (
                  <motion.button
                    key={suggestion.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      isHighlighted
                        ? 'bg-blue-50 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0',
                        suggestion.type === 'recent' && 'text-slate-400',
                        suggestion.type === 'trending' && 'text-amber-500',
                        suggestion.type === 'contract' && 'text-blue-500',
                        suggestion.type === 'party' && 'text-cyan-500',
                        suggestion.type === 'category' && 'text-purple-500'
                      )}
                    />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
                      {suggestion.text}
                    </span>
                    {suggestion.type === 'recent' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecent(suggestion.text);
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                    <ArrowRight
                      className={cn(
                        'h-3.5 w-3.5 text-slate-400 transition-opacity',
                        isHighlighted ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </motion.button>
                );
              })}
            </div>

            {/* Keyboard Hint */}
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">
                    ↑↓
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">
                    ↵
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">
                    Esc
                  </kbd>
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

export default EnhancedSearchInput;
