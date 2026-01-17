'use client';

/**
 * Quick Actions Panel
 * Keyboard-driven quick actions for power users
 */

import React, { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  Search,
  Plus,
  FileText,
  Upload,
  Users,
  Settings,
  Clock,
  Star,
  ArrowRight,
  Keyboard,
  type LucideIcon 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string[];
  category?: string;
  action: () => void;
  keywords?: string[];
}

interface QuickActionsContextValue {
  actions: QuickAction[];
  recentActions: string[];
  executeAction: (id: string) => void;
  registerActions: (actions: QuickAction[]) => void;
}

// ============================================================================
// Quick Actions Panel Component
// ============================================================================

interface QuickActionsPanelProps {
  actions: QuickAction[];
  isOpen: boolean;
  onClose: () => void;
  recentActionIds?: string[];
  onActionExecuted?: (actionId: string) => void;
}

export function QuickActionsPanel({
  actions,
  isOpen,
  onClose,
  recentActionIds = [],
  onActionExecuted,
}: QuickActionsPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    if (!query.trim()) {
      // Show recent first, then all
      const recent = recentActionIds
        .map((id) => actions.find((a) => a.id === id))
        .filter(Boolean) as QuickAction[];
      const rest = actions.filter((a) => !recentActionIds.includes(a.id));
      return [...recent.slice(0, 3), ...rest];
    }

    const lowerQuery = query.toLowerCase();
    return actions.filter((action) => {
      const matchLabel = action.label.toLowerCase().includes(lowerQuery);
      const matchDesc = action.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = action.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
      return matchLabel || matchDesc || matchKeywords;
    });
  }, [query, actions, recentActionIds]);

  // Group by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    
    filteredActions.forEach((action) => {
      const category = action.category || 'Actions';
      if (!groups[category]) groups[category] = [];
      groups[category]!.push(action);
    });

    return groups;
  }, [filteredActions]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredActions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          const selected = filteredActions[selectedIndex];
          if (selected) {
            selected.action();
            onActionExecuted?.(selected.id);
            onClose();
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
  }, [isOpen, filteredActions, selectedIndex, onClose, onActionExecuted]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const executeAction = (action: QuickAction) => {
    action.action();
    onActionExecuted?.(action.id);
    onClose();
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

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header with search */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <Zap className="w-5 h-5 text-indigo-600" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Quick actions..."
                className="flex-1 text-lg outline-none placeholder:text-slate-400"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded">
                esc
              </kbd>
            </div>

            {/* Actions list */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredActions.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No actions found</p>
                </div>
              ) : (
                Object.entries(groupedActions).map(([category, categoryActions]) => (
                  <div key={category} className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {category}
                    </p>
                    {categoryActions.map((action) => {
                      const globalIndex = filteredActions.indexOf(action);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <motion.button
                          key={action.id}
                          onClick={() => executeAction(action)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                            isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          )}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                            isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          )}>
                            <action.icon className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-medium',
                              isSelected ? 'text-indigo-900' : 'text-slate-900'
                            )}>
                              {action.label}
                            </p>
                            {action.description && (
                              <p className="text-sm text-slate-500 truncate">
                                {action.description}
                              </p>
                            )}
                          </div>

                          {action.shortcut && (
                            <div className="flex items-center gap-1">
                              {action.shortcut.map((key, i) => (
                                <kbd
                                  key={i}
                                  className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          )}

                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↵</kbd>
                  select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                {filteredActions.length} actions
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Quick Actions Button
// ============================================================================

interface QuickActionsButtonProps {
  onClick: () => void;
  className?: string;
}

export function QuickActionsButton({ onClick, className }: QuickActionsButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors',
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Zap className="w-4 h-4 text-indigo-600" />
      <span className="text-sm text-slate-700">Quick Actions</span>
      <kbd className="hidden sm:inline px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 text-xs rounded">
        ⌘K
      </kbd>
    </motion.button>
  );
}

// ============================================================================
// useQuickActions Hook
// ============================================================================

interface UseQuickActionsOptions {
  shortcut?: string;
}

export function useQuickActions(options: UseQuickActionsOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentActionIds, setRecentActionIds] = useState<string[]>([]);
  const shortcut = options.shortcut ?? 'k';

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === shortcut) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const trackAction = useCallback((actionId: string) => {
    setRecentActionIds((prev) => {
      const filtered = prev.filter((id) => id !== actionId);
      return [actionId, ...filtered].slice(0, 5);
    });
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    recentActionIds,
    trackAction,
  };
}

// ============================================================================
// Default Actions
// ============================================================================

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-contract',
    label: 'New Contract',
    description: 'Create a new contract document',
    icon: Plus,
    shortcut: ['⌘', 'N'],
    category: 'Create',
    keywords: ['create', 'add', 'document'],
    action: () => { /* New contract action */ },
  },
  {
    id: 'upload-document',
    label: 'Upload Document',
    description: 'Upload a PDF or document for analysis',
    icon: Upload,
    shortcut: ['⌘', 'U'],
    category: 'Create',
    keywords: ['import', 'pdf', 'file'],
    action: () => { /* Upload action */ },
  },
  {
    id: 'search-contracts',
    label: 'Search Contracts',
    description: 'Search across all contracts',
    icon: Search,
    shortcut: ['⌘', 'F'],
    category: 'Navigation',
    keywords: ['find', 'filter'],
    action: () => { /* Search action */ },
  },
  {
    id: 'view-recent',
    label: 'Recent Contracts',
    description: 'View recently accessed contracts',
    icon: Clock,
    category: 'Navigation',
    keywords: ['history', 'last'],
    action: () => { /* Recent action */ },
  },
  {
    id: 'view-starred',
    label: 'Starred Items',
    description: 'View your starred contracts',
    icon: Star,
    category: 'Navigation',
    keywords: ['favorites', 'bookmarks'],
    action: () => { /* Starred action */ },
  },
  {
    id: 'team-members',
    label: 'Team Members',
    description: 'Manage your team',
    icon: Users,
    category: 'Team',
    keywords: ['people', 'invite'],
    action: () => { /* Team action */ },
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Manage your preferences',
    icon: Settings,
    shortcut: ['⌘', ','],
    category: 'System',
    keywords: ['preferences', 'config'],
    action: () => { /* Settings action */ },
  },
];
