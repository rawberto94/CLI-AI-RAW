'use client';

/**
 * Quick Actions Command Bar
 * Keyboard-accessible command palette for quick navigation and actions
 */

import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Command,
  Search,
  FileText,
  Upload,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Home,
  BarChart3,
  Calendar,
  Bell,
  Shield,
  Users,
  Folder,
  PlusCircle,
  ArrowRight,
  Hash,
  Zap,
  Clock,
  Star,
  Keyboard,
  X,
  ChevronRight,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ElementType;
  shortcut?: string[];
  category: string;
  keywords?: string[];
  action: () => void | Promise<void>;
  disabled?: boolean;
}

interface CommandCategory {
  id: string;
  label: string;
  icon?: React.ElementType;
}

// ============================================================================
// Default Categories
// ============================================================================

const defaultCategories: CommandCategory[] = [
  { id: 'navigation', label: 'Navigation', icon: ArrowRight },
  { id: 'actions', label: 'Quick Actions', icon: Zap },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ============================================================================
// Keyboard Shortcut Display
// ============================================================================

const ShortcutKey = memo(({ keys }: { keys: string[] }) => (
  <div className="flex items-center gap-1">
    {keys.map((key, i) => (
      <kbd
        key={i}
        className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-600"
      >
        {key}
      </kbd>
    ))}
  </div>
));

ShortcutKey.displayName = 'ShortcutKey';

// ============================================================================
// Command Item Component
// ============================================================================

interface CommandItemComponentProps {
  item: CommandItem;
  isSelected: boolean;
  onSelect: () => void;
}

const CommandItemComponent = memo(({
  item,
  isSelected,
  onSelect,
}: CommandItemComponentProps) => {
  const Icon = item.icon;

  return (
    <button
      onClick={onSelect}
      disabled={item.disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        isSelected
          ? "bg-violet-50 dark:bg-violet-900/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        item.disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "p-2 rounded-lg",
        isSelected
          ? "bg-violet-100 dark:bg-violet-800"
          : "bg-slate-100 dark:bg-slate-800"
      )}>
        {Icon ? (
          <Icon className={cn(
            "h-4 w-4",
            isSelected
              ? "text-violet-600 dark:text-indigo-400"
              : "text-slate-500 dark:text-slate-400"
          )} />
        ) : (
          <Hash className="h-4 w-4 text-slate-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isSelected
            ? "text-violet-700 dark:text-indigo-300"
            : "text-slate-700 dark:text-slate-300"
        )}>
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {item.description}
          </p>
        )}
      </div>

      {/* Shortcut */}
      {item.shortcut && <ShortcutKey keys={item.shortcut} />}

      {/* Arrow indicator when selected */}
      {isSelected && (
        <ChevronRight className="h-4 w-4 text-violet-500" />
      )}
    </button>
  );
});

CommandItemComponent.displayName = 'CommandItemComponent';

// ============================================================================
// Main Command Bar Component
// ============================================================================

interface QuickActionsCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: CommandItem[];
  categories?: CommandCategory[];
  placeholder?: string;
  recentItems?: string[];
  onRecentItemsChange?: (items: string[]) => void;
}

export const QuickActionsCommandBar = memo(({
  isOpen,
  onClose,
  commands = [],
  categories = defaultCategories,
  placeholder = 'Search commands or type a query...',
  recentItems = [],
  onRecentItemsChange,
}: QuickActionsCommandBarProps) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Default navigation commands
  const defaultCommands = useMemo<CommandItem[]>(() => [
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      icon: Home,
      category: 'navigation',
      keywords: ['home', 'main'],
      shortcut: ['G', 'D'],
      action: () => router.push('/dashboard'),
    },
    {
      id: 'nav-contracts',
      title: 'Go to Contracts',
      icon: FileText,
      category: 'navigation',
      keywords: ['documents', 'files'],
      shortcut: ['G', 'C'],
      action: () => router.push('/contracts'),
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics',
      icon: BarChart3,
      category: 'navigation',
      keywords: ['reports', 'charts', 'stats'],
      shortcut: ['G', 'A'],
      action: () => router.push('/analytics'),
    },
    {
      id: 'nav-calendar',
      title: 'Go to Deadlines',
      icon: Calendar,
      category: 'navigation',
      keywords: ['schedule', 'dates'],
      shortcut: ['G', 'L'],
      action: () => router.push('/deadlines'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      icon: Settings,
      category: 'navigation',
      keywords: ['preferences', 'config'],
      shortcut: ['G', 'S'],
      action: () => router.push('/settings'),
    },
    {
      id: 'action-upload',
      title: 'Upload Contract',
      description: 'Upload a new contract document',
      icon: Upload,
      category: 'actions',
      keywords: ['add', 'new', 'import'],
      shortcut: ['U'],
      action: () => router.push('/upload'),
    },
    {
      id: 'action-new-contract',
      title: 'Create New Contract',
      description: 'Start a new contract from template',
      icon: PlusCircle,
      category: 'actions',
      keywords: ['add', 'new', 'create'],
      shortcut: ['N'],
      action: () => router.push('/drafting'),
    },
    {
      id: 'action-search',
      title: 'Search Contracts',
      description: 'Search through all contracts',
      icon: Search,
      category: 'actions',
      keywords: ['find', 'lookup'],
      shortcut: ['/'],
      action: () => router.push('/search'),
    },
    {
      id: 'action-ai',
      title: 'Ask AI Assistant',
      description: 'Chat with AI about your contracts',
      icon: Zap,
      category: 'actions',
      keywords: ['chat', 'assistant', 'help'],
      shortcut: ['A', 'I'],
      action: () => router.push('/ai/chat'),
    },
  ], [router]);

  // Merge default and custom commands
  const allCommands = useMemo(() => [...defaultCommands, ...commands], [defaultCommands, commands]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) {
      // Show recent items first, then popular actions
      const recent = recentItems
        .map(id => allCommands.find(c => c.id === id))
        .filter(Boolean) as CommandItem[];
      
      const popular = allCommands.filter(c => 
        c.category === 'actions' && !recentItems.includes(c.id)
      ).slice(0, 4);

      return [...recent, ...popular];
    }

    const lowerQuery = query.toLowerCase();
    return allCommands.filter(cmd => {
      const matchTitle = cmd.title.toLowerCase().includes(lowerQuery);
      const matchDescription = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return matchTitle || matchDescription || matchKeywords;
    });
  }, [query, allCommands, recentItems]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });

    return Object.entries(groups).map(([categoryId, items]) => ({
      category: categories.find(c => c.id === categoryId) || { id: categoryId, label: categoryId },
      items,
    }));
  }, [filteredCommands, categories]);

  // Flatten for navigation
  const flatItems = useMemo(() => 
    groupedCommands.flatMap(g => g.items),
    [groupedCommands]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          executeCommand(flatItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatItems, selectedIndex, onClose]);

  // Execute command
  const executeCommand = useCallback((item: CommandItem) => {
    if (item.disabled) return;

    // Track as recent
    if (onRecentItemsChange) {
      const newRecent = [item.id, ...recentItems.filter(id => id !== item.id)].slice(0, 5);
      onRecentItemsChange(newRecent);
    }

    onClose();
    item.action();
  }, [onClose, recentItems, onRecentItemsChange]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div key="QuickActionsCommandBar-ap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Command palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-slate-700">
            <Command className="h-5 w-5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {flatItems.length === 0 ? (
              <div className="py-12 text-center">
                <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No results found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              groupedCommands.map(({ category, items }) => (
                <div key={category.id}>
                  <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                    {category.icon && <category.icon className="h-3 w-3" />}
                    {category.label}
                  </div>
                  {items.map((item) => (
                    <CommandItemComponent
                      key={item.id}
                      item={item}
                      isSelected={flatItems[selectedIndex]?.id === item.id}
                      onSelect={() => executeCommand(item)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="h-3 w-3" />
                Select
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">ESC</kbd>
                Close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">⌘K</kbd>
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

QuickActionsCommandBar.displayName = 'QuickActionsCommandBar';

// ============================================================================
// Hook for using command bar
// ============================================================================

export function useCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<string[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('command-bar-recent');
      if (stored) {
        setRecentItems(JSON.parse(stored));
      }
    } catch {
      // Silently handle parse failure
    }
  }, []);

  // Save recent items
  const handleRecentItemsChange = useCallback((items: string[]) => {
    setRecentItems(items);
    localStorage.setItem('command-bar-recent', JSON.stringify(items));
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
    recentItems,
    onRecentItemsChange: handleRecentItemsChange,
  };
}

export default QuickActionsCommandBar;
