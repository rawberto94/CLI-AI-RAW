'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, Keyboard } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Shortcut {
  id: string;
  keys: string[]; // e.g., ['ctrl', 'k'], ['cmd', 'shift', 'p']
  description: string;
  category?: string;
  action: () => void;
  enabled?: boolean;
  global?: boolean; // Works even when inputs are focused
}

interface ShortcutGroup {
  category: string;
  shortcuts: Shortcut[];
}

interface KeyboardShortcutsContextValue {
  shortcuts: Map<string, Shortcut>;
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (id: string) => void;
  enableShortcut: (id: string, enabled: boolean) => void;
  triggerShortcut: (id: string) => void;
  showHelp: () => void;
  hideHelp: () => void;
  isHelpOpen: boolean;
}

// ============================================================================
// Context
// ============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  helpKey?: string[]; // Default: ['?'] or ['shift', '/']
}

export function KeyboardShortcutsProvider({
  children,
  helpKey = ['shift', '/'],
}: KeyboardShortcutsProviderProps) {
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [, forceUpdate] = useState({});

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    shortcutsRef.current.set(shortcut.id, { ...shortcut, enabled: shortcut.enabled ?? true });
    forceUpdate({});
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
    forceUpdate({});
  }, []);

  const enableShortcut = useCallback((id: string, enabled: boolean) => {
    const shortcut = shortcutsRef.current.get(id);
    if (shortcut) {
      shortcutsRef.current.set(id, { ...shortcut, enabled });
      forceUpdate({});
    }
  }, []);

  const triggerShortcut = useCallback((id: string) => {
    const shortcut = shortcutsRef.current.get(id);
    if (shortcut?.enabled) {
      shortcut.action();
    }
  }, []);

  const showHelp = useCallback(() => setIsHelpOpen(true), []);
  const hideHelp = useCallback(() => setIsHelpOpen(false), []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      const isInputFocused = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      // Parse pressed keys
      const pressedKeys: string[] = [];
      if (e.metaKey || e.ctrlKey) pressedKeys.push(navigator.platform.includes('Mac') ? 'cmd' : 'ctrl');
      if (e.shiftKey) pressedKeys.push('shift');
      if (e.altKey) pressedKeys.push('alt');
      
      // Add the actual key
      const key = e.key.toLowerCase();
      if (!['meta', 'control', 'shift', 'alt'].includes(key)) {
        pressedKeys.push(key);
      }

      // Check for help key
      if (keysMatch(pressedKeys, helpKey)) {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
        return;
      }

      // Find matching shortcut
      for (const shortcut of shortcutsRef.current.values()) {
        if (!shortcut.enabled) continue;
        if (isInputFocused && !shortcut.global) continue;

        if (keysMatch(pressedKeys, shortcut.keys)) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [helpKey]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        shortcuts: shortcutsRef.current,
        registerShortcut,
        unregisterShortcut,
        enableShortcut,
        triggerShortcut,
        showHelp,
        hideHelp,
        isHelpOpen,
      }}
    >
      {children}
      <ShortcutsHelpModal 
        isOpen={isHelpOpen} 
        onClose={hideHelp}
        shortcuts={shortcutsRef.current}
      />
    </KeyboardShortcutsContext.Provider>
  );
}

// ============================================================================
// Shortcuts Help Modal
// ============================================================================

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Map<string, Shortcut>;
}

function ShortcutsHelpModal({ isOpen, onClose, shortcuts }: ShortcutsHelpModalProps) {
  // Group shortcuts by category
  const groups: ShortcutGroup[] = [];
  const uncategorized: Shortcut[] = [];

  shortcuts.forEach(shortcut => {
    if (shortcut.category) {
      const existing = groups.find(g => g.category === shortcut.category);
      if (existing) {
        existing.shortcuts.push(shortcut);
      } else {
        groups.push({ category: shortcut.category, shortcuts: [shortcut] });
      }
    } else {
      uncategorized.push(shortcut);
    }
  });

  if (uncategorized.length > 0) {
    groups.unshift({ category: 'General', shortcuts: uncategorized });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="contents">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 max-h-[70vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Keyboard className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Keyboard Shortcuts
                </h2>
                <p className="text-sm text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">?</kbd> to toggle this menu
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.category}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {group.category}
                    </h3>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {shortcut.description}
                          </span>
                          <ShortcutKeys keys={shortcut.keys} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Shortcut Keys Display
// ============================================================================

interface ShortcutKeysProps {
  keys: string[];
  size?: 'sm' | 'md';
}

export function ShortcutKeys({ keys, size = 'sm' }: ShortcutKeysProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  const formatKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      cmd: isMac ? '⌘' : 'Ctrl',
      ctrl: isMac ? '⌃' : 'Ctrl',
      alt: isMac ? '⌥' : 'Alt',
      shift: isMac ? '⇧' : 'Shift',
      enter: '↵',
      backspace: '⌫',
      delete: '⌦',
      escape: 'Esc',
      tab: '⇥',
      space: '␣',
      up: '↑',
      down: '↓',
      left: '←',
      right: '→',
    };
    return keyMap[key.toLowerCase()] || key.toUpperCase();
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs min-w-[20px]',
    md: 'px-2 py-1 text-sm min-w-[28px]',
  };

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          <kbd
            className={`
              inline-flex items-center justify-center font-mono
              bg-gray-100 dark:bg-gray-700 
              text-gray-600 dark:text-gray-300
              border border-gray-300 dark:border-gray-600
              rounded shadow-sm
              ${sizeClasses[size]}
            `}
          >
            {formatKey(key)}
          </kbd>
          {index < keys.length - 1 && (
            <span className="text-gray-400 text-xs">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// useShortcut Hook
// ============================================================================

interface UseShortcutOptions {
  keys: string[];
  action: () => void;
  description?: string;
  category?: string;
  enabled?: boolean;
  global?: boolean;
}

export function useShortcut(id: string, options: UseShortcutOptions) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut({
      id,
      keys: options.keys,
      action: options.action,
      description: options.description || id,
      category: options.category,
      enabled: options.enabled ?? true,
      global: options.global,
    });

    return () => unregisterShortcut(id);
  }, [id, options, registerShortcut, unregisterShortcut]);
}

// ============================================================================
// Shortcut Hint Component
// ============================================================================

interface ShortcutHintProps {
  keys: string[];
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function ShortcutHint({
  keys,
  children,
  position = 'bottom',
  className = '',
}: ShortcutHintProps) {
  const [showHint, setShowHint] = useState(false);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowHint(true)}
      onMouseLeave={() => setShowHint(false)}
    >
      {children}
      <AnimatePresence>
        {showHint && (
          <motion.div key="hint"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`absolute z-50 ${positionClasses[position]}`}
          >
            <div className="px-2 py-1 bg-gray-900 text-white rounded-lg shadow-lg whitespace-nowrap">
              <ShortcutKeys keys={keys} size="sm" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Command Menu Trigger
// ============================================================================

interface CommandMenuTriggerProps {
  onClick: () => void;
  className?: string;
}

export function CommandMenuTrigger({ onClick, className = '' }: CommandMenuTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5
        bg-gray-100 dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-lg text-sm text-gray-500
        hover:bg-gray-200 dark:hover:bg-gray-700
        transition-colors
        ${className}
      `}
    >
      <Command className="w-4 h-4" />
      <span>Search</span>
      <div className="flex items-center gap-0.5 ml-4">
        <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded text-xs border border-gray-300 dark:border-gray-600">
          ⌘
        </kbd>
        <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded text-xs border border-gray-300 dark:border-gray-600">
          K
        </kbd>
      </div>
    </button>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function keysMatch(pressed: string[], target: string[]): boolean {
  if (pressed.length !== target.length) return false;
  
  const normalizedPressed = pressed.map(k => k.toLowerCase()).sort();
  const normalizedTarget = target.map(k => k.toLowerCase()).sort();
  
  return normalizedPressed.every((key, i) => key === normalizedTarget[i]);
}
