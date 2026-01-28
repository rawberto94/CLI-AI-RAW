/**
 * Command Palette (⌘K)
 * Quick navigation and command execution
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Search,
  FileText,
  Upload,
  BarChart3,
  Settings,
  Home,
  CreditCard,
  Target,
  TrendingUp,
  Users,
  HelpCircle,
  Moon,
  Sun,
  LogOut,
  Command,
  ArrowRight,
  CornerDownLeft,
  History,
  Sparkles,
  Zap,
  FileSearch
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigation' | 'actions' | 'settings' | 'recent';
  keywords?: string[];
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define all commands
  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-home',
      title: 'Go to Dashboard',
      description: 'Main dashboard with overview',
      icon: Home,
      action: () => { router.push('/'); onClose(); },
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main'],
      shortcut: 'G H'
    },
    {
      id: 'nav-contracts',
      title: 'Go to Contracts',
      description: 'View all contracts',
      icon: FileText,
      action: () => { router.push('/contracts'); onClose(); },
      category: 'navigation',
      keywords: ['contracts', 'list', 'documents'],
      shortcut: 'G C'
    },
    {
      id: 'nav-upload',
      title: 'Upload Contract',
      description: 'Upload a new contract for analysis',
      icon: Upload,
      action: () => { router.push('/upload'); onClose(); },
      category: 'navigation',
      keywords: ['upload', 'new', 'add', 'import'],
      shortcut: 'G U'
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics',
      description: 'View analytics and insights',
      icon: BarChart3,
      action: () => { router.push('/dashboard'); onClose(); },
      category: 'navigation',
      keywords: ['analytics', 'charts', 'metrics', 'reports']
    },
    {
      id: 'nav-rate-cards',
      title: 'Go to Rate Cards',
      description: 'Rate card management and benchmarking',
      icon: CreditCard,
      action: () => { router.push('/rate-cards'); onClose(); },
      category: 'navigation',
      keywords: ['rates', 'pricing', 'benchmark', 'cards']
    },
    {
      id: 'nav-search',
      title: 'Search Contracts',
      description: 'Full-text search across all contracts',
      icon: FileSearch,
      action: () => { router.push('/search'); onClose(); },
      category: 'navigation',
      keywords: ['search', 'find', 'query']
    },
    {
      id: 'nav-templates',
      title: 'Go to Templates',
      description: 'Contract templates',
      icon: FileText,
      action: () => { router.push('/templates'); onClose(); },
      category: 'navigation',
      keywords: ['templates', 'boilerplate']
    },
    // Actions
    {
      id: 'action-new-contract',
      title: 'Create New Contract',
      description: 'Start a new contract from template',
      icon: Sparkles,
      action: () => { router.push('/contracts/new'); onClose(); },
      category: 'actions',
      keywords: ['create', 'new', 'contract', 'draft']
    },
    {
      id: 'action-ai-analyze',
      title: 'AI Analysis',
      description: 'Run AI analysis on selected contract',
      icon: Zap,
      action: () => { /* Open AI analysis modal */ onClose(); },
      category: 'actions',
      keywords: ['ai', 'analyze', 'analyze', 'gpt', 'intelligence']
    },
    {
      id: 'action-benchmarking',
      title: 'Run Benchmarking',
      description: 'Compare rates against market',
      icon: Target,
      action: () => { router.push('/rate-cards/benchmarking'); onClose(); },
      category: 'actions',
      keywords: ['benchmark', 'compare', 'rates', 'market']
    },
    // Settings
    {
      id: 'settings-main',
      title: 'Settings',
      description: 'Application settings and preferences',
      icon: Settings,
      action: () => { router.push('/settings'); onClose(); },
      category: 'settings',
      keywords: ['settings', 'preferences', 'config'],
      shortcut: 'G S'
    },
    {
      id: 'settings-help',
      title: 'Help & Support',
      description: 'Documentation and support resources',
      icon: HelpCircle,
      action: () => { router.push('/help'); onClose(); },
      category: 'settings',
      keywords: ['help', 'support', 'docs', 'documentation']
    }
  ], [router, onClose]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      const searchText = [
        cmd.title,
        cmd.description,
        ...(cmd.keywords || [])
      ].join(' ').toLowerCase();
      
      return searchText.includes(lowerQuery);
    });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      settings: [],
      recent: []
    };

    filteredCommands.forEach(cmd => {
      const group = groups[cmd.category];
      if (group) {
        group.push(cmd);
      }
    });

    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    recent: 'Recent'
  };

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="relative mx-auto mt-[15vh] max-w-xl"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  aria-label="Command palette search"
                  className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none text-base"
                />
                <kbd className="px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                  ESC
                </kbd>
              </div>

              {/* Command List */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {filteredCommands.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No commands found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, items]) => {
                    if (items.length === 0) return null;

                    return (
                      <div key={category} className="mb-4 last:mb-0">
                        <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {categoryLabels[category]}
                        </p>
                        <div className="space-y-0.5">
                          {items.map((command) => {
                            const currentIndex = flatIndex++;
                            const isSelected = currentIndex === selectedIndex;

                            return (
                              <button
                                key={command.id}
                                onClick={command.action}
                                onMouseEnter={() => setSelectedIndex(currentIndex)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                                  isSelected
                                    ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                )}
                              >
                                <div className={cn(
                                  'p-1.5 rounded-lg',
                                  isSelected
                                    ? 'bg-violet-100 dark:bg-violet-800 text-violet-600 dark:text-violet-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                )}>
                                  <command.icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {command.title}
                                  </p>
                                  {command.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {command.description}
                                    </p>
                                  )}
                                </div>
                                {command.shortcut && (
                                  <kbd className="px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                                    {command.shortcut}
                                  </kbd>
                                )}
                                {isSelected && (
                                  <ArrowRight className="h-4 w-4 text-violet-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">↵</kbd>
                    select
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="h-3 w-3" />
                  <span>K to toggle</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Command Palette Trigger Hook
 * Use this to enable ⌘K shortcut globally
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
}

export default CommandPalette;
