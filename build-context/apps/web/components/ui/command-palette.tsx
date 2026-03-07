/**
 * Command Palette (P5: Polish)
 * 
 * Opened via `GlobalKeyboardShortcuts` (Cmd/Ctrl+K)
 * Quick actions, navigation, and search
 */

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Command,
  Search,
  FileText,
  Upload,
  BarChart3,
  MessageSquare,
  Settings,
  Sun,
  Moon,
  Home,
  FolderOpen,
  RefreshCw,
  HelpCircle,
  User,
  LogOut,
  Plus,
  Zap,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  category: 'navigation' | 'actions' | 'settings' | 'help';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define commands
  const commands = useMemo<CommandItem[]>(() => [
    // Navigation
    {
      id: 'home',
      title: 'Go to Dashboard',
      description: 'View your contract overview',
      icon: Home,
      category: 'navigation',
      action: () => router.push('/'),
      keywords: ['home', 'dashboard', 'overview'],
    },
    {
      id: 'contracts',
      title: 'Go to Contracts',
      description: 'Browse all contracts',
      icon: FileText,
      category: 'navigation',
      action: () => router.push('/contracts'),
      keywords: ['contracts', 'documents', 'list'],
    },
    {
      id: 'upload',
      title: 'Go to Upload',
      description: 'Upload new contracts',
      icon: Upload,
      category: 'navigation',
      action: () => router.push('/upload'),
      keywords: ['upload', 'new', 'add'],
    },
    {
      id: 'analytics',
      title: 'Go to Analytics',
      description: 'View insights and reports',
      icon: BarChart3,
      category: 'navigation',
      action: () => router.push('/analytics'),
      keywords: ['analytics', 'reports', 'insights', 'charts'],
    },
    {
      id: 'search',
      title: 'Go to Search',
      description: 'Search all contracts',
      icon: Search,
      category: 'navigation',
      action: () => router.push('/search'),
      keywords: ['search', 'find', 'query'],
    },
    {
      id: 'ai-chat',
      title: 'Open AI Assistant',
      description: 'Chat with AI about contracts',
      icon: MessageSquare,
      category: 'navigation',
      action: () => router.push('/ai/chat'),
      keywords: ['ai', 'chat', 'assistant', 'help'],
    },
    
    // Actions
    {
      id: 'new-contract',
      title: 'Upload New Contract',
      description: 'Add a new contract to your portfolio',
      icon: Plus,
      category: 'actions',
      action: () => router.push('/upload'),
      keywords: ['new', 'create', 'upload', 'add'],
    },
    {
      id: 'refresh',
      title: 'Refresh Data',
      description: 'Reload all data',
      icon: RefreshCw,
      category: 'actions',
      action: () => window.location.reload(),
      keywords: ['refresh', 'reload', 'update'],
    },
    {
      id: 'quick-analyze',
      title: 'Quick AI Analysis',
      description: 'Analyze a contract with AI',
      icon: Zap,
      category: 'actions',
      action: () => router.push('/ai/chat'),
      keywords: ['analyze', 'ai', 'quick'],
    },
    
    // Settings
    {
      id: 'toggle-dark',
      title: 'Toggle Dark Mode',
      description: 'Switch between light and dark theme',
      icon: Moon,
      category: 'settings',
      action: () => {
        const root = document.documentElement;
        const isDark = root.classList.contains('dark');
        root.classList.toggle('dark', !isDark);
        root.classList.toggle('light', isDark);
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
      },
      keywords: ['dark', 'light', 'theme', 'mode'],
    },
    {
      id: 'settings',
      title: 'Open Settings',
      description: 'Manage your preferences',
      icon: Settings,
      category: 'settings',
      action: () => router.push('/settings'),
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'profile',
      title: 'View Profile',
      description: 'Manage your account',
      icon: User,
      category: 'settings',
      action: () => router.push('/settings/profile'),
      keywords: ['profile', 'account', 'user'],
    },
    
    // Help
    {
      id: 'help',
      title: 'Help & Documentation',
      description: 'View help and guides',
      icon: HelpCircle,
      category: 'help',
      action: () => window.open('/docs', '_blank'),
      keywords: ['help', 'docs', 'documentation', 'guide'],
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: Command,
      category: 'help',
      action: () => {
        // Dispatch event to open shortcuts overlay
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      },
      keywords: ['keyboard', 'shortcuts', 'hotkeys'],
    },
  ], [router]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((k) => k.includes(lowerQuery));
      return titleMatch || descMatch || keywordMatch;
    });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      const category = cmd.category ?? 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category]!.push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    help: 'Help',
  };

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Close and reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="contents">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 
                       w-[90vw] max-w-xl
                       bg-white dark:bg-slate-900 rounded-xl shadow-2xl 
                       border border-gray-200 dark:border-gray-700
                       z-50 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-foreground
                         placeholder:text-muted-foreground"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 
                            rounded border border-gray-200 dark:border-gray-700">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No commands found</p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => (
                  <div key={category} className="mb-4 last:mb-0">
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                            'transition-colors touch-manipulation',
                            globalIndex === selectedIndex
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {cmd.title}
                            </div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded border">↑↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded border">↵</kbd>
                  to select
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredCommands.length} commands
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage command palette state.
 * Keyboard bindings are handled centrally by `GlobalKeyboardShortcuts`.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

export default CommandPalette;
