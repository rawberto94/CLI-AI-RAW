/**
 * Intelligent Search Component
 * AI-powered search with suggestions, recent searches, and quick actions
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Clock, 
  FileText, 
  Building2, 
  Tag,
  Sparkles,
  ArrowRight,
  Command,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchSuggestion {
  id: string;
  type: 'contract' | 'supplier' | 'category' | 'ai_suggestion';
  title: string;
  subtitle?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_KEY = 'contigo-recent-searches';

export function IntelligentSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const newSearch: RecentSearch = { 
      query: searchQuery.trim(), 
      timestamp: Date.now() 
    };
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.query.toLowerCase() !== searchQuery.toLowerCase());
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Fetch suggestions
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        } else {
          // Fallback to basic suggestions
          setSuggestions([
            {
              id: 'search-all',
              type: 'ai_suggestion',
              title: `Search for "${debouncedQuery}"`,
              subtitle: 'Search all contracts',
              href: `/search?q=${encodeURIComponent(debouncedQuery)}`,
              icon: Search,
            },
            {
              id: 'ai-ask',
              type: 'ai_suggestion', 
              title: `Ask AI about "${debouncedQuery}"`,
              subtitle: 'Get AI-powered insights',
              href: `/ai/chat?q=${encodeURIComponent(debouncedQuery)}`,
              icon: Sparkles,
            },
          ]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (query ? 0 : recentSearches.length);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (totalItems || 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % (totalItems || 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            saveRecentSearch(query);
            router.push(selected.href);
            setIsOpen(false);
            setQuery('');
          }
        } else if (query.trim()) {
          saveRecentSearch(query);
          router.push(`/search?q=${encodeURIComponent(query)}`);
          setIsOpen(false);
          setQuery('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [suggestions, recentSearches, selectedIndex, query, router, saveRecentSearch]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    saveRecentSearch(query || suggestion.title);
    router.push(suggestion.href);
    setIsOpen(false);
    setQuery('');
  };

  const handleRecentClick = (recentQuery: string) => {
    setQuery(recentQuery);
    router.push(`/search?q=${encodeURIComponent(recentQuery)}`);
    setIsOpen(false);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'contract': return FileText;
      case 'supplier': return Building2;
      case 'category': return Tag;
      case 'ai_suggestion': return Sparkles;
      default: return Search;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={cn(
        "relative flex items-center transition-all duration-200",
        isOpen && "ring-2 ring-violet-500/30 rounded-lg"
      )}>
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search contracts, suppliers..."
          className="w-full h-10 pl-10 pr-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-violet-300 transition-all"
        />
        <div className="absolute right-2 flex items-center gap-1.5">
          {isLoading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
          {query && (
            <button 
              onClick={() => { setQuery(''); setSuggestions([]); }}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (query || recentSearches.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="py-2">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => {
                  const Icon = suggestion.icon || getIconForType(suggestion.type);
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        selectedIndex === index 
                          ? "bg-violet-50 dark:bg-violet-900/30" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        suggestion.type === 'ai_suggestion' 
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {suggestion.title}
                        </p>
                        {suggestion.subtitle && (
                          <p className="text-xs text-slate-500 truncate">{suggestion.subtitle}</p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div className="py-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Recent Searches
                  </span>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Clear all
                  </button>
                </div>
                {recentSearches.map((recent, index) => (
                  <button
                    key={recent.timestamp}
                    onClick={() => handleRecentClick(recent.query)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      selectedIndex === suggestions.length + index
                        ? "bg-violet-50 dark:bg-violet-900/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{recent.query}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-1 px-2">
                <button
                  onClick={() => { router.push('/contracts'); setIsOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  All Contracts
                </button>
                <button
                  onClick={() => { 
                    window.dispatchEvent(new CustomEvent('openAIChatbot', {
                      detail: { autoMessage: debouncedQuery ? `Help me find: ${debouncedQuery}` : 'Help me search my contracts' }
                    })); 
                    setIsOpen(false); 
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-[9px]">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-[9px]">↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-[9px]">↵</kbd>
                    select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-[9px]">esc</kbd>
                  close
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default IntelligentSearch;
