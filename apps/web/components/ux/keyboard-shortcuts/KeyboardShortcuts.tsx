'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  X,
  Search,
  Command,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Delete,
  Plus,
  Minus,
  Home,
  FileText,
  Settings,
  Upload,
  BarChart3,
  Users,
  MessageSquare,
  Bell,
  Moon,
  Sun,
  HelpCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action?: () => void;
  global?: boolean;
}

export interface ShortcutCategory {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcuts: KeyboardShortcut[];
}

interface KeyboardShortcutsContextType {
  isOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleShortcuts: () => void;
  shortcuts: ShortcutCategory[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
};

// ============================================================================
// Key Display Component
// ============================================================================

interface KeyProps {
  children: ReactNode;
  className?: string;
}

export const Key = memo(function Key({ children, className = '' }: KeyProps) {
  // Map special keys to icons/symbols
  const keyMap: Record<string, ReactNode> = {
    cmd: <Command className="w-3 h-3" />,
    command: <Command className="w-3 h-3" />,
    '⌘': <Command className="w-3 h-3" />,
    ctrl: 'Ctrl',
    control: 'Ctrl',
    alt: 'Alt',
    option: '⌥',
    shift: '⇧',
    enter: <CornerDownLeft className="w-3 h-3" />,
    return: <CornerDownLeft className="w-3 h-3" />,
    esc: 'Esc',
    escape: 'Esc',
    up: <ArrowUp className="w-3 h-3" />,
    down: <ArrowDown className="w-3 h-3" />,
    left: <ArrowLeft className="w-3 h-3" />,
    right: <ArrowRight className="w-3 h-3" />,
    delete: <Delete className="w-3 h-3" />,
    backspace: '⌫',
    tab: '⇥',
    space: 'Space',
    '+': <Plus className="w-3 h-3" />,
    '-': <Minus className="w-3 h-3" />,
  };

  const content =
    typeof children === 'string'
      ? keyMap[children.toLowerCase()] || children.toUpperCase()
      : children;

  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-zinc-100 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-sm ${className}`}
    >
      {content}
    </kbd>
  );
});

// ============================================================================
// Shortcut Keys Display
// ============================================================================

interface ShortcutKeysProps {
  keys: string[];
  className?: string;
}

export const ShortcutKeys = memo(function ShortcutKeys({
  keys,
  className = '',
}: ShortcutKeysProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          <Key>{key}</Key>
          {index < keys.length - 1 && (
            <span className="text-zinc-400 text-xs">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
});

// ============================================================================
// Default Shortcuts
// ============================================================================

const defaultShortcuts: ShortcutCategory[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    icon: Home,
    shortcuts: [
      { id: 'goto-dashboard', keys: ['G', 'D'], description: 'Go to Dashboard', category: 'navigation' },
      { id: 'goto-contracts', keys: ['G', 'C'], description: 'Go to Contracts', category: 'navigation' },
      { id: 'goto-upload', keys: ['G', 'U'], description: 'Go to Upload', category: 'navigation' },
      { id: 'goto-analytics', keys: ['G', 'A'], description: 'Go to Analytics', category: 'navigation' },
      { id: 'goto-settings', keys: ['G', 'S'], description: 'Go to Settings', category: 'navigation' },
    ],
  },
  {
    id: 'actions',
    name: 'Quick Actions',
    icon: Command,
    shortcuts: [
      { id: 'command-palette', keys: ['⌘', 'K'], description: 'Open command palette', category: 'actions', global: true },
      { id: 'quick-search', keys: ['⌘', '/'], description: 'Quick search', category: 'actions', global: true },
      { id: 'new-upload', keys: ['⌘', 'U'], description: 'Upload new contract', category: 'actions' },
      { id: 'new-contract', keys: ['⌘', 'N'], description: 'Create new contract', category: 'actions' },
      { id: 'refresh', keys: ['⌘', 'R'], description: 'Refresh current view', category: 'actions' },
    ],
  },
  {
    id: 'editing',
    name: 'Editing',
    icon: FileText,
    shortcuts: [
      { id: 'save', keys: ['⌘', 'S'], description: 'Save changes', category: 'editing', global: true },
      { id: 'undo', keys: ['⌘', 'Z'], description: 'Undo', category: 'editing' },
      { id: 'redo', keys: ['⌘', 'Shift', 'Z'], description: 'Redo', category: 'editing' },
      { id: 'select-all', keys: ['⌘', 'A'], description: 'Select all', category: 'editing' },
      { id: 'copy', keys: ['⌘', 'C'], description: 'Copy', category: 'editing' },
      { id: 'paste', keys: ['⌘', 'V'], description: 'Paste', category: 'editing' },
    ],
  },
  {
    id: 'view',
    name: 'View',
    icon: Settings,
    shortcuts: [
      { id: 'toggle-sidebar', keys: ['⌘', 'B'], description: 'Toggle sidebar', category: 'view' },
      { id: 'toggle-theme', keys: ['⌘', 'Shift', 'T'], description: 'Toggle dark mode', category: 'view' },
      { id: 'zoom-in', keys: ['⌘', '+'], description: 'Zoom in', category: 'view' },
      { id: 'zoom-out', keys: ['⌘', '-'], description: 'Zoom out', category: 'view' },
      { id: 'reset-zoom', keys: ['⌘', '0'], description: 'Reset zoom', category: 'view' },
    ],
  },
  {
    id: 'help',
    name: 'Help',
    icon: HelpCircle,
    shortcuts: [
      { id: 'show-shortcuts', keys: ['?'], description: 'Show keyboard shortcuts', category: 'help', global: true },
      { id: 'help-center', keys: ['⌘', 'Shift', 'H'], description: 'Open help center', category: 'help' },
      { id: 'feedback', keys: ['⌘', 'Shift', 'F'], description: 'Send feedback', category: 'help' },
    ],
  },
];

// ============================================================================
// Provider
// ============================================================================

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  customShortcuts?: ShortcutCategory[];
}

export const KeyboardShortcutsProvider = memo(function KeyboardShortcutsProvider({
  children,
  customShortcuts = [],
}: KeyboardShortcutsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [registeredShortcuts, setRegisteredShortcuts] = useState<KeyboardShortcut[]>([]);

  // Merge default and custom shortcuts
  const shortcuts = useMemo(() => {
    const merged = [...defaultShortcuts];

    // Add custom shortcuts
    customShortcuts.forEach((category) => {
      const existing = merged.find((c) => c.id === category.id);
      if (existing) {
        existing.shortcuts = [...existing.shortcuts, ...category.shortcuts];
      } else {
        merged.push(category);
      }
    });

    // Add registered shortcuts
    registeredShortcuts.forEach((shortcut) => {
      const category = merged.find((c) => c.id === shortcut.category);
      if (category) {
        if (!category.shortcuts.find((s) => s.id === shortcut.id)) {
          category.shortcuts.push(shortcut);
        }
      }
    });

    return merged;
  }, [customShortcuts, registeredShortcuts]);

  const openShortcuts = useCallback(() => setIsOpen(true), []);
  const closeShortcuts = useCallback(() => setIsOpen(false), []);
  const toggleShortcuts = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setRegisteredShortcuts((prev) => {
      if (prev.find((s) => s.id === shortcut.id)) return prev;
      return [...prev, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setRegisteredShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Global keyboard listener for ? key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts on ? key
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleShortcuts();
        }
      }

      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        closeShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleShortcuts, closeShortcuts]);

  const value = useMemo(
    () => ({
      isOpen,
      openShortcuts,
      closeShortcuts,
      toggleShortcuts,
      shortcuts,
      registerShortcut,
      unregisterShortcut,
    }),
    [isOpen, openShortcuts, closeShortcuts, toggleShortcuts, shortcuts, registerShortcut, unregisterShortcut]
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
      <KeyboardShortcutsOverlay />
    </KeyboardShortcutsContext.Provider>
  );
});

// ============================================================================
// Overlay Component
// ============================================================================

const KeyboardShortcutsOverlay = memo(function KeyboardShortcutsOverlay() {
  const { isOpen, closeShortcuts, shortcuts } = useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter shortcuts based on search
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery) return shortcuts;

    const query = searchQuery.toLowerCase();
    return shortcuts
      .map((category) => ({
        ...category,
        shortcuts: category.shortcuts.filter(
          (s) =>
            s.description.toLowerCase().includes(query) ||
            s.keys.some((k) => k.toLowerCase().includes(query))
        ),
      }))
      .filter((category) => category.shortcuts.length > 0);
  }, [shortcuts, searchQuery]);

  // Display shortcuts based on selected category or all
  const displayedShortcuts = useMemo(() => {
    if (selectedCategory) {
      return filteredShortcuts.filter((c) => c.id === selectedCategory);
    }
    return filteredShortcuts;
  }, [filteredShortcuts, selectedCategory]);

  // Reset search and category when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeShortcuts}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl max-h-[80vh] mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-500 rounded-xl">
                    <Keyboard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      Keyboard Shortcuts
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Press <Key>?</Key> to toggle this menu
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeShortcuts}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shortcuts..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 -mb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    !selectedCategory
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  All
                </button>
                {shortcuts.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {category.icon && <category.icon className="w-3.5 h-3.5" />}
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-200px)] p-6">
              {displayedShortcuts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No shortcuts found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {displayedShortcuts.map((category) => (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-3">
                        {category.icon && (
                          <category.icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                        )}
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wide">
                          {category.name}
                        </h3>
                      </div>
                      <div className="grid gap-2">
                        {category.shortcuts.map((shortcut) => (
                          <motion.div
                            key={shortcut.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                          >
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              {shortcut.description}
                            </span>
                            <ShortcutKeys keys={shortcut.keys} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 px-6 py-3">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Key>↑</Key>
                    <Key>↓</Key>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <Key>Enter</Key>
                    Execute
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Key>Esc</Key>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Shortcut Trigger Button
// ============================================================================

interface ShortcutsTriggerProps {
  className?: string;
}

export const ShortcutsTrigger = memo(function ShortcutsTrigger({
  className = '',
}: ShortcutsTriggerProps) {
  const { openShortcuts } = useKeyboardShortcuts();

  return (
    <button
      onClick={openShortcuts}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors ${className}`}
      title="Keyboard shortcuts"
    >
      <Keyboard className="w-4 h-4" />
      <span className="hidden sm:inline">Shortcuts</span>
      <Key className="hidden sm:inline-flex">?</Key>
    </button>
  );
});

// ============================================================================
// Inline Shortcut Hint
// ============================================================================

interface ShortcutHintProps {
  keys: string[];
  className?: string;
  showOnHover?: boolean;
}

export const ShortcutHint = memo(function ShortcutHint({
  keys,
  className = '',
  showOnHover = false,
}: ShortcutHintProps) {
  if (showOnHover) {
    return (
      <span
        className={`opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
      >
        <ShortcutKeys keys={keys} />
      </span>
    );
  }

  return <ShortcutKeys keys={keys} className={className} />;
});
