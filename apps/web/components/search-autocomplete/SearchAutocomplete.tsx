'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Clock, TrendingUp, ArrowRight, Loader2,
  History, Sparkles, FileText, User, Tag, Folder
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface SearchGroup {
  id: string;
  label: string;
  results: SearchResult[];
}

// ============================================================================
// Search Autocomplete
// ============================================================================

interface SearchAutocompleteProps {
  onSearch: (query: string) => void | Promise<void>;
  onResultClick?: (result: SearchResult) => void;
  fetchResults?: (query: string) => Promise<SearchResult[] | SearchGroup[]>;
  placeholder?: string;
  recentSearches?: string[];
  onClearRecent?: () => void;
  popularSearches?: string[];
  debounceMs?: number;
  minChars?: number;
  showTrending?: boolean;
  className?: string;
}

export function SearchAutocomplete({
  onSearch,
  onResultClick,
  fetchResults,
  placeholder = 'Search...',
  recentSearches = [],
  onClearRecent,
  popularSearches = [],
  debounceMs = 300,
  minChars = 2,
  showTrending = true,
  className = '',
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | SearchGroup[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (results.length === 0) return [];
    if ('results' in results[0]) {
      return (results as SearchGroup[]).flatMap(g => g.results);
    }
    return results as SearchResult[];
  }, [results]);

  // Fetch results with debounce
  useEffect(() => {
    if (query.length < minChars) {
      setResults([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (fetchResults) {
        setIsLoading(true);
        try {
          const res = await fetchResults(query);
          setResults(res);
        } finally {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchResults, debounceMs, minChars]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < flatResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && flatResults[highlightedIndex]) {
          handleResultClick(flatResults[highlightedIndex]);
        } else if (query) {
          onSearch(query);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result);
    result.onClick?.();
    setQuery(result.title);
    setIsOpen(false);
  };

  const handleSearchClick = (term: string) => {
    setQuery(term);
    onSearch(term);
    setIsOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDropdown = isOpen && (
    query.length >= minChars || 
    recentSearches.length > 0 || 
    (showTrending && popularSearches.length > 0)
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div key="dropdown"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[400px] overflow-y-auto"
          >
            {/* Results */}
            {query.length >= minChars && results.length > 0 && (
              <div className="py-2">
                {(results[0] as SearchGroup).results ? (
                  // Grouped results
                  (results as SearchGroup[]).map(group => (
                    <div key={group.id}>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                        {group.label}
                      </div>
                      {group.results.map((result, idx) => {
                        const flatIdx = flatResults.indexOf(result);
                        return (
                          <SearchResultItem
                            key={result.id}
                            result={result}
                            highlighted={flatIdx === highlightedIndex}
                            onClick={() => handleResultClick(result)}
                          />
                        );
                      })}
                    </div>
                  ))
                ) : (
                  // Flat results
                  (results as SearchResult[]).map((result, idx) => (
                    <SearchResultItem
                      key={result.id}
                      result={result}
                      highlighted={idx === highlightedIndex}
                      onClick={() => handleResultClick(result)}
                    />
                  ))
                )}
              </div>
            )}

            {/* No results */}
            {query.length >= minChars && results.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No results found for &quot;{query}&quot;</p>
              </div>
            )}

            {/* Recent Searches */}
            {query.length < minChars && recentSearches.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent
                  </span>
                  {onClearRecent && (
                    <button
                      onClick={onClearRecent}
                      className="text-xs text-violet-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearchClick(term)}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <History className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{term}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Trending/Popular */}
            {query.length < minChars && showTrending && popularSearches.length > 0 && (
              <div className="py-2 border-t border-gray-100 dark:border-gray-800">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Trending
                </div>
                {popularSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearchClick(term)}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-700 dark:text-gray-300">{term}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Search Result Item
// ============================================================================

interface SearchResultItemProps {
  result: SearchResult;
  highlighted: boolean;
  onClick: () => void;
}

function SearchResultItem({ result, highlighted, onClick }: SearchResultItemProps) {
  const typeIcons: Record<string, React.ReactNode> = {
    file: <FileText className="w-4 h-4" />,
    user: <User className="w-4 h-4" />,
    tag: <Tag className="w-4 h-4" />,
    folder: <Folder className="w-4 h-4" />,
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors
        ${highlighted 
          ? 'bg-violet-50 dark:bg-violet-950' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
    >
      <span className="flex-shrink-0 text-gray-400">
        {result.icon || typeIcons[result.type || ''] || <Search className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 dark:text-white truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
        )}
      </div>
      {result.type && (
        <span className="flex-shrink-0 text-xs text-gray-400 uppercase">
          {result.type}
        </span>
      )}
      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </button>
  );
}

// ============================================================================
// Search Spotlight (Full-screen search)
// ============================================================================

interface SearchSpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  fetchResults?: (query: string) => Promise<SearchResult[] | SearchGroup[]>;
  placeholder?: string;
  recentSearches?: string[];
  shortcuts?: { label: string; keys: string[]; onClick: () => void }[];
}

export function SearchSpotlight({
  isOpen,
  onClose,
  onSearch,
  fetchResults,
  placeholder = 'Search anything...',
  recentSearches = [],
  shortcuts = [],
}: SearchSpotlightProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="fixed inset-0 z-[200]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Spotlight */}
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="relative z-10 max-w-2xl mx-auto mt-[15vh]"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
              {/* Input */}
              <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <Search className="w-6 h-6 text-gray-400 mr-4" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && query) {
                      onSearch(query);
                      onClose();
                    }
                  }}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
                <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                  ESC
                </kbd>
              </div>

              {/* Content */}
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Recent */}
                {recentSearches.length > 0 && !query && (
                  <div className="py-3">
                    <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Recent Searches
                    </div>
                    {recentSearches.slice(0, 5).map((term, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onSearch(term);
                          onClose();
                        }}
                        className="w-full px-6 py-2.5 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{term}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Shortcuts */}
                {shortcuts.length > 0 && !query && (
                  <div className="py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Quick Actions
                    </div>
                    {shortcuts.map((shortcut, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          shortcut.onClick();
                          onClose();
                        }}
                        className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="text-gray-700 dark:text-gray-300">{shortcut.label}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, j) => (
                            <kbd key={j} className="px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// useSearchHistory Hook
// ============================================================================

export function useSearchHistory(key: string = 'search-history', maxItems: number = 10) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {}
    }
  }, [key]);

  const addToHistory = useCallback((term: string) => {
    setHistory(prev => {
      const filtered = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, maxItems);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  }, [key, maxItems]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(key);
    setHistory([]);
  }, [key]);

  const removeFromHistory = useCallback((term: string) => {
    setHistory(prev => {
      const updated = prev.filter(t => t !== term);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  }, [key]);

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
  };
}
