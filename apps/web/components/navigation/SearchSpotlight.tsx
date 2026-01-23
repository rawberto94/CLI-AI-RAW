'use client';

/**
 * Search Spotlight
 * Command palette style search for quick navigation and actions
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  FileText, 
  Upload, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  User,
  Home,
  ArrowRight,
  Clock,
  Command,
  Sparkles,
  Keyboard,
  HelpCircle,
  Moon,
  Sun,
  Zap,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpotlightItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  category: 'navigation' | 'action' | 'recent' | 'command';
  href?: string;
  action?: () => void;
  keywords?: string[];
  shortcut?: string;
}

const defaultItems: SpotlightItem[] = [
  // Navigation
  { id: 'nav-home', title: 'Dashboard', description: 'Go to dashboard', icon: Home, category: 'navigation', href: '/dashboard', keywords: ['dashboard', 'main', 'home'] },
  { id: 'nav-contracts', title: 'Contracts', description: 'Browse all contracts', icon: FileText, category: 'navigation', href: '/contracts', keywords: ['files', 'documents'] },
  { id: 'nav-upload', title: 'Upload', description: 'Upload new contracts', icon: Upload, category: 'navigation', href: '/upload', keywords: ['new', 'add', 'import'] },
  { id: 'nav-ai-chat', title: 'AI Assistant', description: 'Chat with AI', icon: MessageSquare, category: 'navigation', href: '/ai/chat', keywords: ['chatbot', 'ask', 'help'] },
  { id: 'nav-analytics', title: 'Analytics', description: 'View insights', icon: BarChart3, category: 'navigation', href: '/analytics', keywords: ['stats', 'reports', 'data'] },
  { id: 'nav-settings', title: 'Settings', description: 'Configure preferences', icon: Settings, category: 'navigation', href: '/settings', keywords: ['config', 'preferences'] },
  { id: 'nav-profile', title: 'Profile', description: 'Manage your account', icon: User, category: 'navigation', href: '/settings/profile', keywords: ['account', 'user'] },
  
  // Actions
  { id: 'action-quick-upload', title: 'Quick Upload', description: 'Upload a contract now', icon: Upload, category: 'action', href: '/upload', shortcut: '⌘U', keywords: ['fast', 'new'] },
  { id: 'action-new-chat', title: 'New AI Chat', description: 'Start a new conversation', icon: Sparkles, category: 'action', href: '/ai/chat/new', shortcut: '⌘/', keywords: ['ask', 'question'] },
  
  // Commands
  { id: 'cmd-shortcuts', title: 'Keyboard Shortcuts', description: 'View all shortcuts', icon: Keyboard, category: 'command', action: () => window.dispatchEvent(new CustomEvent('openKeyboardShortcuts')), shortcut: '?' },
  { id: 'cmd-help', title: 'Help & Documentation', description: 'Get help using the app', icon: HelpCircle, category: 'command', href: '/help', keywords: ['docs', 'support', 'guide'] },
  { id: 'cmd-theme', title: 'Toggle Theme', description: 'Switch dark/light mode', icon: Moon, category: 'command', action: () => document.documentElement.classList.toggle('dark'), shortcut: '⌘T' },
];

interface SearchSpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  additionalItems?: SpotlightItem[];
  recentSearches?: string[];
}

export function SearchSpotlight({ 
  isOpen, 
  onClose, 
  additionalItems = [],
  recentSearches = [],
}: SearchSpotlightProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Combine default and additional items
  const allItems = useMemo(() => [...defaultItems, ...additionalItems], [additionalItems]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show categorized view when no query
      return allItems.slice(0, 8);
    }

    const lowerQuery = query.toLowerCase();
    return allItems.filter(item => {
      const matchTitle = item.title.toLowerCase().includes(lowerQuery);
      const matchDescription = item.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = item.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return matchTitle || matchDescription || matchKeywords;
    }).slice(0, 10);
  }, [query, allItems]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SpotlightItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle item selection
  const handleSelect = useCallback((item: SpotlightItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }, [onClose, router]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Global keyboard shortcut to open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          window.dispatchEvent(new CustomEvent('openSearchSpotlight'));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Pages',
    action: 'Quick Actions',
    recent: 'Recent',
    command: 'Commands',
  };

  const categoryIcons: Record<string, React.ElementType> = {
    navigation: ArrowRight,
    action: Zap,
    recent: Clock,
    command: Hash,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Spotlight Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, actions, or commands..."
                  className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none text-sm"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 text-[10px] text-slate-500">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500">No results found</p>
                    <p className="text-xs text-slate-400 mt-1">Try searching for pages, actions, or commands</p>
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      {/* Category Header */}
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        {React.createElement(categoryIcons[category] || ArrowRight, {
                          className: "h-3 w-3 text-slate-400"
                        })}
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {categoryLabels[category] || category}
                        </span>
                      </div>

                      {/* Items */}
                      {items.map((item) => {
                        const globalIndex = filteredItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                              isSelected
                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <div className={cn(
                              "flex-shrink-0 p-2 rounded-lg",
                              isSelected
                                ? "bg-indigo-100 dark:bg-indigo-900/50"
                                : "bg-slate-100 dark:bg-slate-800"
                            )}>
                              <item.icon className={cn(
                                "h-4 w-4",
                                isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                              )} />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {item.shortcut && (
                              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                {item.shortcut}
                              </kbd>
                            )}
                            {isSelected && (
                              <ArrowRight className="h-4 w-4 text-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">ESC</kbd>
                    Close
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Command className="h-3 w-3" />
                  <span>K to search</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to manage spotlight state
export function useSearchSpotlight() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('openSearchSpotlight', handleOpen);
    
    // Also listen for Cmd+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('openSearchSpotlight', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

export default SearchSpotlight;
