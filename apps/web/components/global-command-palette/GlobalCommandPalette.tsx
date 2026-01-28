'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Clock,
  Star,
  Hash,
  FileText,
  User,
  Settings,
  HelpCircle,
  Zap,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  category?: string;
  shortcut?: string[];
  action: () => void | Promise<void>;
  disabled?: boolean;
  pinned?: boolean;
}

interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommands: (commands: CommandItem[]) => void;
  unregisterCommands: (ids: string[]) => void;
}

// ============================================================================
// Context
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useGlobalCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useGlobalCommandPalette must be used within GlobalCommandPaletteProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface GlobalCommandPaletteProviderProps {
  children: React.ReactNode;
  defaultCommands?: CommandItem[];
  placeholder?: string;
  hotkey?: string[]; // Default: ['cmd', 'k']
  maxRecent?: number;
}

export function GlobalCommandPaletteProvider({
  children,
  defaultCommands = [],
  placeholder = 'Search commands...',
  hotkey = ['cmd', 'k'],
  maxRecent = 5,
}: GlobalCommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<CommandItem[]>(defaultCommands);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const registerCommands = useCallback((newCommands: CommandItem[]) => {
    setCommands(prev => {
      const existing = new Set(prev.map(c => c.id));
      const toAdd = newCommands.filter(c => !existing.has(c.id));
      return [...prev, ...toAdd];
    });
  }, []);

  const unregisterCommands = useCallback((ids: string[]) => {
    setCommands(prev => prev.filter(c => !ids.includes(c.id)));
  }, []);

  const handleExecute = useCallback((id: string) => {
    setRecentIds(prev => {
      const filtered = prev.filter(i => i !== id);
      return [id, ...filtered].slice(0, maxRecent);
    });
  }, [maxRecent]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }

      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        registerCommands,
        unregisterCommands,
      }}
    >
      {children}
      <GlobalCommandPaletteModal
        isOpen={isOpen}
        onClose={close}
        commands={commands}
        recentIds={recentIds}
        onExecute={handleExecute}
        placeholder={placeholder}
      />
    </CommandPaletteContext.Provider>
  );
}

// ============================================================================
// Modal
// ============================================================================

interface GlobalCommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  recentIds: string[];
  onExecute: (id: string) => void;
  placeholder: string;
}

function GlobalCommandPaletteModal({
  isOpen,
  onClose,
  commands,
  recentIds,
  onExecute,
  placeholder,
}: GlobalCommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter and group commands
  const { groups, flatList } = useMemo(() => {
    let filtered = commands.filter(c => !c.disabled);

    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(cmd => {
        const searchText = [
          cmd.label,
          cmd.description,
          ...(cmd.keywords || []),
        ].join(' ').toLowerCase();
        return fuzzyMatch(lowerQuery, searchText);
      });

      // Sort by relevance
      filtered.sort((a, b) => {
        const aScore = getMatchScore(query, a);
        const bScore = getMatchScore(query, b);
        return bScore - aScore;
      });
    }

    // Group by category
    const groupMap = new Map<string, CommandItem[]>();
    
    // Add recent commands first if no query
    if (!query && recentIds.length > 0) {
      const recent = recentIds
        .map(id => commands.find(c => c.id === id))
        .filter((c): c is CommandItem => c !== undefined && !c.disabled);
      if (recent.length > 0) {
        groupMap.set('Recent', recent);
      }
    }

    // Add pinned commands
    const pinned = filtered.filter(c => c.pinned);
    if (pinned.length > 0) {
      groupMap.set('Pinned', pinned);
    }

    // Group remaining by category
    filtered.filter(c => !c.pinned).forEach(cmd => {
      const category = cmd.category || 'Commands';
      const existing = groupMap.get(category) || [];
      if (!recentIds.includes(cmd.id) || query) {
        existing.push(cmd);
        groupMap.set(category, existing);
      }
    });

    const groups: CommandGroup[] = [];
    groupMap.forEach((items, label) => {
      if (items.length > 0) {
        groups.push({ id: label, label, items });
      }
    });

    const flatList = groups.flatMap(g => g.items);

    return { groups, flatList };
  }, [commands, query, recentIds]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            executeCommand(flatList[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatList, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedEl = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeCommand = async (command: CommandItem) => {
    setIsLoading(true);
    try {
      await command.action();
      onExecute(command.id);
      onClose();
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-24 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                ) : (
                  <Search className="w-5 h-5 text-gray-400" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent border-0 outline-none text-gray-900 dark:text-slate-100 dark:text-white placeholder-gray-400"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-y-auto">
                {flatList.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No commands found</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {groups.map((group) => (
                      <div key={group.id}>
                        <div className="px-4 py-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {group.label}
                          </span>
                        </div>
                        {group.items.map((item) => {
                          const globalIndex = flatList.indexOf(item);
                          return (
                            <CommandItemRow
                              key={item.id}
                              item={item}
                              isSelected={globalIndex === selectedIndex}
                              index={globalIndex}
                              onClick={() => executeCommand(item)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-slate-400">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" />
                    <ArrowDown className="w-3 h-3" />
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CornerDownLeft className="w-3 h-3" />
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd>
                    <span>Close</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>Command Palette</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Command Item Row
// ============================================================================

interface CommandItemRowProps {
  item: CommandItem;
  isSelected: boolean;
  index: number;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItemRow({ item, isSelected, index, onClick, onMouseEnter }: CommandItemRowProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5
        text-left transition-colors
        ${isSelected
          ? 'bg-violet-50 dark:bg-violet-950 text-violet-900 dark:text-violet-100'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        }
      `}
    >
      {/* Icon */}
      <div className={`
        flex-shrink-0 p-1.5 rounded-lg
        ${isSelected
          ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
        }
      `}>
        {item.icon || <Zap className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.label}</p>
        {item.description && (
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.description}</p>
        )}
      </div>

      {/* Shortcut */}
      {item.shortcut && (
        <div className="flex-shrink-0 flex items-center gap-0.5">
          {item.shortcut.map((key, i) => (
            <kbd
              key={i}
              className={`
                px-1.5 py-0.5 text-xs rounded border
                ${isSelected
                  ? 'bg-violet-100 dark:bg-violet-800 border-violet-200 dark:border-violet-700'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }
              `}
            >
              {formatShortcutKey(key, isMac)}
            </kbd>
          ))}
        </div>
      )}

      {/* Pinned indicator */}
      {item.pinned && (
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
      )}
    </button>
  );
}

// ============================================================================
// Predefined Commands Factory
// ============================================================================

export function createNavigationCommands(
  routes: Array<{ path: string; label: string; icon?: React.ReactNode }>
): CommandItem[] {
  return routes.map(route => ({
    id: `nav-${route.path}`,
    label: `Go to ${route.label}`,
    description: route.path,
    icon: route.icon || <FileText className="w-4 h-4" />,
    category: 'Navigation',
    keywords: ['go', 'navigate', 'page', route.label.toLowerCase()],
    action: () => {
      window.location.href = route.path;
    },
  }));
}

export function createSearchCommands(
  searchFn: (query: string) => void
): CommandItem[] {
  return [
    {
      id: 'search-files',
      label: 'Search files',
      icon: <FileText className="w-4 h-4" />,
      category: 'Search',
      shortcut: ['cmd', 'p'],
      action: () => searchFn('files'),
    },
    {
      id: 'search-users',
      label: 'Search users',
      icon: <User className="w-4 h-4" />,
      category: 'Search',
      action: () => searchFn('users'),
    },
  ];
}

export function createThemeCommands(
  setTheme: (theme: 'light' | 'dark' | 'system') => void
): CommandItem[] {
  return [
    {
      id: 'theme-light',
      label: 'Switch to light mode',
      category: 'Theme',
      keywords: ['theme', 'appearance', 'light'],
      action: () => setTheme('light'),
    },
    {
      id: 'theme-dark',
      label: 'Switch to dark mode',
      category: 'Theme',
      keywords: ['theme', 'appearance', 'dark'],
      action: () => setTheme('dark'),
    },
    {
      id: 'theme-system',
      label: 'Use system theme',
      category: 'Theme',
      keywords: ['theme', 'appearance', 'system', 'auto'],
      action: () => setTheme('system'),
    },
  ];
}

export const HELP_COMMANDS: CommandItem[] = [
  {
    id: 'help-shortcuts',
    label: 'View keyboard shortcuts',
    icon: <Command className="w-4 h-4" />,
    category: 'Help',
    shortcut: ['shift', '/'],
    action: () => {
      // Trigger help modal
      window.dispatchEvent(new CustomEvent('show-shortcuts-help'));
    },
  },
  {
    id: 'help-docs',
    label: 'Open documentation',
    icon: <HelpCircle className="w-4 h-4" />,
    category: 'Help',
    action: () => {
      window.open('/docs', '_blank');
    },
  },
  {
    id: 'help-settings',
    label: 'Open settings',
    icon: <Settings className="w-4 h-4" />,
    category: 'Help',
    shortcut: ['cmd', ','],
    action: () => {
      window.location.href = '/settings';
    },
  },
];

// ============================================================================
// Utilities
// ============================================================================

function fuzzyMatch(query: string, text: string): boolean {
  let queryIndex = 0;
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === query.length;
}

function getMatchScore(query: string, item: CommandItem): number {
  const label = item.label.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (label === lowerQuery) return 100;

  // Starts with query
  if (label.startsWith(lowerQuery)) return 80;

  // Contains query as word
  if (label.includes(` ${lowerQuery}`)) return 60;

  // Contains query
  if (label.includes(lowerQuery)) return 40;

  // Fuzzy match in keywords
  const keywords = (item.keywords || []).join(' ').toLowerCase();
  if (keywords.includes(lowerQuery)) return 20;

  return 10;
}

function formatShortcutKey(key: string, isMac: boolean): string {
  const keyMap: Record<string, string> = {
    cmd: isMac ? '⌘' : 'Ctrl',
    ctrl: isMac ? '⌃' : 'Ctrl',
    alt: isMac ? '⌥' : 'Alt',
    shift: '⇧',
    enter: '↵',
  };
  return keyMap[key.toLowerCase()] || key.toUpperCase();
}
