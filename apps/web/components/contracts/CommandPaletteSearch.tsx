'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Sparkles,
  Clock,
  TrendingUp,
  ArrowRight,
  FileText,
  Shield,
  AlertTriangle,
  CalendarClock,
  Building2,
  Tag,
  Command,
  Hash,
  Settings,
  Upload,
  Download,
  Filter,
  Eye,
  ArrowUpRight,
  CornerDownLeft,
  Zap,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  iconColor?: string;
  category: 'action' | 'filter' | 'navigation' | 'ai' | 'recent';
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  onAISearch: (query: string) => void;
  onFilterChange: (filter: string, value: string) => void;
  onNavigate: (contractId: string) => void;
  recentContracts: { id: string; title: string }[];
  onUploadClick: () => void;
  onExportClick: () => void;
  className?: string;
}

// ============================================================================
// Quick Filter Commands
// ============================================================================

const QUICK_FILTERS: CommandItem[] = [
  {
    id: 'filter-high-risk',
    label: 'High Risk Contracts',
    description: 'Show contracts with high risk assessment',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    category: 'filter',
    action: () => {},
  },
  {
    id: 'filter-expiring',
    label: 'Expiring Soon',
    description: 'Contracts expiring in the next 30 days',
    icon: CalendarClock,
    iconColor: 'text-amber-500',
    category: 'filter',
    action: () => {},
  },
  {
    id: 'filter-processing',
    label: 'Processing',
    description: 'Contracts currently being processed',
    icon: Clock,
    iconColor: 'text-violet-500',
    category: 'filter',
    action: () => {},
  },
  {
    id: 'filter-active',
    label: 'Active Contracts',
    description: 'All active and completed contracts',
    icon: FileText,
    iconColor: 'text-violet-500',
    category: 'filter',
    action: () => {},
  },
];

const AI_COMMANDS: CommandItem[] = [
  {
    id: 'ai-analyze',
    label: 'Analyze with AI',
    description: 'Get AI insights on your contracts',
    icon: Bot,
    iconColor: 'text-violet-500',
    category: 'ai',
    action: () => {},
  },
  {
    id: 'ai-summarize',
    label: 'AI Summary',
    description: 'Generate an overview of filtered contracts',
    icon: Sparkles,
    iconColor: 'text-purple-500',
    category: 'ai',
    action: () => {},
  },
  {
    id: 'ai-risk',
    label: 'Risk Analysis',
    description: 'AI-powered risk assessment',
    icon: Shield,
    iconColor: 'text-orange-500',
    category: 'ai',
    action: () => {},
  },
];

// ============================================================================
// Main Component
// ============================================================================

export const CommandPaletteSearch = memo(function CommandPaletteSearch({
  isOpen,
  onClose,
  onSearch,
  onAISearch,
  onFilterChange,
  onNavigate,
  recentContracts,
  onUploadClick,
  onExportClick,
  className = '',
}: CommandPaletteSearchProps) {
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build commands list
  const commands = useMemo(() => {
    const items: CommandItem[] = [];

    // If typing, show AI search first
    if (query.trim()) {
      items.push({
        id: 'ai-search',
        label: `Ask AI: "${query}"`,
        description: 'Natural language search with AI assistance',
        icon: Sparkles,
        iconColor: 'text-violet-500',
        category: 'ai',
        action: () => {
          onAISearch(query);
          onClose();
        },
      });
      items.push({
        id: 'search',
        label: `Search: "${query}"`,
        description: 'Search contracts, parties, and terms',
        icon: Search,
        iconColor: 'text-violet-500',
        category: 'action',
        action: () => {
          onSearch(query);
          onClose();
        },
      });
    }

    // Recent contracts
    if (!query && recentContracts.length > 0) {
      recentContracts.slice(0, 3).forEach((contract) => {
        items.push({
          id: `recent-${contract.id}`,
          label: contract.title,
          description: 'Recently viewed',
          icon: Clock,
          iconColor: 'text-slate-400',
          category: 'recent',
          action: () => {
            onNavigate(contract.id);
            onClose();
          },
        });
      });
    }

    // Quick filters
    if (!query || query.toLowerCase().includes('filter') || query.toLowerCase().includes('show')) {
      QUICK_FILTERS.forEach((filter) => {
        if (!query || filter.label.toLowerCase().includes(query.toLowerCase())) {
          items.push({
            ...filter,
            action: () => {
              if (filter.id === 'filter-high-risk') {
                onFilterChange('risk', 'high');
              } else if (filter.id === 'filter-expiring') {
                onFilterChange('expiration', 'expiring-30');
              } else if (filter.id === 'filter-processing') {
                onFilterChange('status', 'processing');
              } else if (filter.id === 'filter-active') {
                onFilterChange('status', 'completed');
              }
              onClose();
            },
          });
        }
      });
    }

    // AI Commands
    if (!query || query.toLowerCase().includes('ai') || query.toLowerCase().includes('analyze')) {
      AI_COMMANDS.forEach((cmd) => {
        if (!query || cmd.label.toLowerCase().includes(query.toLowerCase())) {
          items.push({
            ...cmd,
            action: () => {
              onAISearch(cmd.description || cmd.label);
              onClose();
            },
          });
        }
      });
    }

    // Actions
    if (!query) {
      items.push({
        id: 'action-upload',
        label: 'Upload Contract',
        description: 'Upload a new contract document',
        icon: Upload,
        iconColor: 'text-violet-500',
        category: 'action',
        action: () => {
          onUploadClick();
          onClose();
        },
        shortcut: '⌘U',
      });
      items.push({
        id: 'action-export',
        label: 'Export Contracts',
        description: 'Download contracts as CSV or PDF',
        icon: Download,
        iconColor: 'text-violet-500',
        category: 'action',
        action: () => {
          onExportClick();
          onClose();
        },
        shortcut: '⌘E',
      });
    }

    return items;
  }, [query, recentContracts, onSearch, onAISearch, onFilterChange, onNavigate, onUploadClick, onExportClick, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, commands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (commands[highlightedIndex]) {
            commands[highlightedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [commands, highlightedIndex, onClose]
  );

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // This would need to be handled by the parent
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'action': return 'Actions';
      case 'filter': return 'Quick Filters';
      case 'navigation': return 'Navigation';
      case 'ai': return 'AI Assistant';
      case 'recent': return 'Recent';
      default: return 'Results';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'action': return Zap;
      case 'filter': return Filter;
      case 'navigation': return ArrowUpRight;
      case 'ai': return Sparkles;
      case 'recent': return Clock;
      default: return FileText;
    }
  };

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    commands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [commands]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Command Palette */}
        <div className="absolute inset-0 flex items-start justify-center pt-[15vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              "w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden",
              className
            )}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search contracts, run commands, or ask AI..."
                className="flex-1 bg-transparent text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
              {Object.entries(groupedCommands).map(([category, items]) => {
                const CategoryIcon = getCategoryIcon(category);
                return (
                  <div key={category} className="pb-2">
                    {/* Category Header */}
                    <div className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {getCategoryLabel(category)}
                    </div>

                    {/* Items */}
                    {items.map((item, itemIndex) => {
                      const globalIndex = commands.findIndex((c) => c.id === item.id);
                      const isHighlighted = globalIndex === highlightedIndex;
                      const ItemIcon = item.icon;

                      return (
                        <button
                          key={item.id}
                          data-index={globalIndex}
                          onClick={item.action}
                          onMouseEnter={() => setHighlightedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2.5 transition-colors",
                            isHighlighted
                              ? "bg-violet-50 dark:bg-violet-950/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                            isHighlighted 
                              ? "bg-violet-100 dark:bg-violet-900/50" 
                              : "bg-slate-100 dark:bg-slate-800"
                          )}>
                            <ItemIcon className={cn("h-4 w-4", item.iconColor || "text-slate-500")} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isHighlighted ? "text-violet-900 dark:text-violet-100" : "text-slate-900 dark:text-slate-100"
                            )}>
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {item.shortcut && (
                            <kbd className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                              {item.shortcut}
                            </kbd>
                          )}
                          {isHighlighted && (
                            <CornerDownLeft className="flex-shrink-0 h-4 w-4 text-violet-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty State */}
              {commands.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No results found for &quot;{query}&quot;
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Try a different search or ask AI for help
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">Esc</kbd>
                  Close
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Sparkles className="h-3 w-3 text-violet-500" />
                <span>AI-powered search</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
});

export default CommandPaletteSearch;
