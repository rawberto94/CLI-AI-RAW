'use client';

/**
 * Keyboard Shortcuts Help Panel
 * Accessible keyboard shortcuts reference with search and categories
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Search,
  X,
  Command,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Navigation,
  FileText,
  MessageSquare,
  Settings,
  Upload,
  Eye,
  Edit,
  Trash2,
  Copy,
  Undo,
  Redo,
  Save,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: ShortcutCategory;
  action?: () => void;
}

type ShortcutCategory = 
  | 'navigation'
  | 'contracts'
  | 'editing'
  | 'chat'
  | 'general';

const CATEGORY_INFO: Record<ShortcutCategory, { label: string; icon: React.ElementType }> = {
  navigation: { label: 'Navigation', icon: Navigation },
  contracts: { label: 'Contracts', icon: FileText },
  editing: { label: 'Editing', icon: Edit },
  chat: { label: 'AI Chat', icon: MessageSquare },
  general: { label: 'General', icon: Settings },
};

// ============================================
// Default Shortcuts
// ============================================

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { id: 'go-home', keys: ['G', 'H'], description: 'Go to Dashboard', category: 'navigation' },
  { id: 'go-contracts', keys: ['G', 'C'], description: 'Go to Contracts', category: 'navigation' },
  { id: 'go-upload', keys: ['G', 'U'], description: 'Go to Upload', category: 'navigation' },
  { id: 'go-rate-cards', keys: ['G', 'R'], description: 'Go to Rate Cards', category: 'navigation' },
  { id: 'go-settings', keys: ['G', 'S'], description: 'Go to Settings', category: 'navigation' },
  { id: 'open-search', keys: ['⌘', 'K'], description: 'Open Command Palette', category: 'navigation' },
  { id: 'focus-sidebar', keys: ['['], description: 'Focus Sidebar', category: 'navigation' },
  { id: 'toggle-sidebar', keys: ['⌘', 'B'], description: 'Toggle Sidebar', category: 'navigation' },
  
  // Contracts
  { id: 'new-contract', keys: ['N'], description: 'Upload New Contract', category: 'contracts' },
  { id: 'view-contract', keys: ['Enter'], description: 'View Selected Contract', category: 'contracts' },
  { id: 'edit-contract', keys: ['E'], description: 'Edit Contract', category: 'contracts' },
  { id: 'delete-contract', keys: ['Delete'], description: 'Delete Contract', category: 'contracts' },
  { id: 'duplicate', keys: ['⌘', 'D'], description: 'Duplicate Contract', category: 'contracts' },
  { id: 'export', keys: ['⌘', 'E'], description: 'Export Contract', category: 'contracts' },
  { id: 'select-all', keys: ['⌘', 'A'], description: 'Select All', category: 'contracts' },
  { id: 'deselect', keys: ['Escape'], description: 'Deselect All', category: 'contracts' },
  
  // Editing
  { id: 'save', keys: ['⌘', 'S'], description: 'Save Changes', category: 'editing' },
  { id: 'undo', keys: ['⌘', 'Z'], description: 'Undo', category: 'editing' },
  { id: 'redo', keys: ['⌘', 'Shift', 'Z'], description: 'Redo', category: 'editing' },
  { id: 'copy', keys: ['⌘', 'C'], description: 'Copy', category: 'editing' },
  { id: 'paste', keys: ['⌘', 'V'], description: 'Paste', category: 'editing' },
  { id: 'cut', keys: ['⌘', 'X'], description: 'Cut', category: 'editing' },
  { id: 'find', keys: ['⌘', 'F'], description: 'Find in Document', category: 'editing' },
  
  // Chat
  { id: 'open-chat', keys: ['⌘', 'J'], description: 'Open AI Chat', category: 'chat' },
  { id: 'new-chat', keys: ['⌘', 'Shift', 'N'], description: 'New Chat Thread', category: 'chat' },
  { id: 'send-message', keys: ['⌘', 'Enter'], description: 'Send Message', category: 'chat' },
  { id: 'clear-chat', keys: ['⌘', 'Shift', 'K'], description: 'Clear Chat History', category: 'chat' },
  
  // General
  { id: 'show-shortcuts', keys: ['?'], description: 'Show Keyboard Shortcuts', category: 'general' },
  { id: 'toggle-theme', keys: ['⌘', 'Shift', 'T'], description: 'Toggle Dark/Light Mode', category: 'general' },
  { id: 'zoom-in', keys: ['⌘', '+'], description: 'Zoom In', category: 'general' },
  { id: 'zoom-out', keys: ['⌘', '-'], description: 'Zoom Out', category: 'general' },
  { id: 'reset-zoom', keys: ['⌘', '0'], description: 'Reset Zoom', category: 'general' },
  { id: 'refresh', keys: ['⌘', 'R'], description: 'Refresh Page', category: 'general' },
  { id: 'logout', keys: ['⌘', 'Shift', 'Q'], description: 'Sign Out', category: 'general' },
];

// ============================================
// Key Display Component
// ============================================

interface KeyProps {
  keyName: string;
  size?: 'sm' | 'md';
}

function Key({ keyName, size = 'md' }: KeyProps) {
  const isMac = typeof window !== 'undefined' && navigator.platform.includes('Mac');
  
  const displayKey = useMemo(() => {
    const keyMap: Record<string, string> = {
      '⌘': isMac ? '⌘' : 'Ctrl',
      'Ctrl': isMac ? '⌘' : 'Ctrl',
      'Alt': isMac ? '⌥' : 'Alt',
      'Shift': '⇧',
      'Enter': '↵',
      'Escape': 'Esc',
      'Delete': '⌫',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Tab': '⇥',
      'Space': '␣',
    };
    return keyMap[keyName] || keyName;
  }, [keyName, isMac]);

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center font-mono font-medium',
        'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
        'rounded shadow-sm',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs min-w-[20px]' : 'px-2 py-1 text-sm min-w-[28px]'
      )}
    >
      {displayKey}
    </kbd>
  );
}

// ============================================
// Shortcut Row Component
// ============================================

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
  highlighted?: boolean;
}

function ShortcutRow({ shortcut, highlighted }: ShortcutRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center justify-between py-2 px-3 rounded-lg transition-colors',
        highlighted ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      )}
    >
      <span className="text-sm text-slate-700 dark:text-slate-300">
        {shortcut.description}
      </span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, idx) => (
          <React.Fragment key={key}>
            <Key keyName={key} size="sm" />
            {idx < shortcut.keys.length - 1 && (
              <span className="text-slate-400 text-xs mx-0.5">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================
// Keyboard Shortcuts Panel
// ============================================

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  customShortcuts?: KeyboardShortcut[];
}

export function KeyboardShortcutsPanel({
  isOpen,
  onClose,
  customShortcuts = [],
}: KeyboardShortcutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ShortcutCategory | 'all'>('all');
  
  const allShortcuts = useMemo(
    () => [...DEFAULT_SHORTCUTS, ...customShortcuts],
    [customShortcuts]
  );

  const filteredShortcuts = useMemo(() => {
    let filtered = allShortcuts;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(s => s.category === activeCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s =>
          s.description.toLowerCase().includes(query) ||
          s.keys.some(k => k.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allShortcuts, activeCategory, searchQuery]);

  const groupedShortcuts = useMemo(() => {
    const groups: Record<ShortcutCategory, KeyboardShortcut[]> = {
      navigation: [],
      contracts: [],
      editing: [],
      chat: [],
      general: [],
    };
    
    filteredShortcuts.forEach(shortcut => {
      groups[shortcut.category].push(shortcut);
    });
    
    return groups;
  }, [filteredShortcuts]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Global shortcut to open (?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !isOpen && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        // This would trigger parent to open the panel
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full sm:max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Keyboard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Quick actions to boost productivity
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shortcuts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                  activeCategory === 'all'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                All
              </button>
              {(Object.keys(CATEGORY_INFO) as ShortcutCategory[]).map(category => {
                const { label, icon: Icon } = CATEGORY_INFO[category];
                return (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                      activeCategory === category
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Shortcuts List */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeCategory === 'all' ? (
                <div className="space-y-6">
                  {(Object.keys(groupedShortcuts) as ShortcutCategory[]).map(category => {
                    const shortcuts = groupedShortcuts[category];
                    if (shortcuts.length === 0) return null;
                    
                    const { label, icon: Icon } = CATEGORY_INFO[category];
                    
                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-slate-400" />
                          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                            {label}
                          </h3>
                        </div>
                        <div className="space-y-1">
                          {shortcuts.map(shortcut => (
                            <ShortcutRow
                              key={shortcut.id}
                              shortcut={shortcut}
                              highlighted={searchQuery.length > 0}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredShortcuts.map(shortcut => (
                    <ShortcutRow
                      key={shortcut.id}
                      shortcut={shortcut}
                      highlighted={searchQuery.length > 0}
                    />
                  ))}
                </div>
              )}

              {filteredShortcuts.length === 0 && (
                <div className="text-center py-12">
                  <Keyboard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    No shortcuts found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>Press <Key keyName="?" size="sm" /> anywhere to open this panel</span>
                <span>Press <Key keyName="Escape" size="sm" /> to close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Hook for Keyboard Shortcuts
// ============================================

export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  const openShortcuts = useCallback(() => setIsOpen(true), []);
  const closeShortcuts = useCallback(() => setIsOpen(false), []);
  const toggleShortcuts = useCallback(() => setIsOpen(prev => !prev), []);

  // Global ? key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        toggleShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleShortcuts]);

  return {
    isOpen,
    openShortcuts,
    closeShortcuts,
    toggleShortcuts,
  };
}

// ============================================
// Keyboard Shortcuts Button
// ============================================

export function KeyboardShortcutsButton() {
  const { isOpen, openShortcuts, closeShortcuts } = useKeyboardShortcuts();

  return (
    <>
      <button
        onClick={openShortcuts}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="w-4 h-4" />
        <span className="hidden sm:inline">Shortcuts</span>
        <Key keyName="?" size="sm" />
      </button>
      <KeyboardShortcutsPanel isOpen={isOpen} onClose={closeShortcuts} />
    </>
  );
}

export default KeyboardShortcutsPanel;
