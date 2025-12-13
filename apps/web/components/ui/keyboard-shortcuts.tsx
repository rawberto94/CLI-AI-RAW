/**
 * Keyboard Shortcuts Overlay (P5: Polish)
 * 
 * Displays available keyboard shortcuts when user presses "?"
 * Provides power-user features for fast navigation
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ['g', 'h'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['g', 'c'], description: 'Go to Contracts', category: 'Navigation' },
  { keys: ['g', 'u'], description: 'Go to Upload', category: 'Navigation' },
  { keys: ['g', 'a'], description: 'Go to Analytics', category: 'Navigation' },
  { keys: ['g', 's'], description: 'Go to Search', category: 'Navigation' },
  
  // Actions
  { keys: ['⌘/Ctrl', 'k'], description: 'Open Command Palette', category: 'Actions' },
  { keys: ['⌘/Ctrl', '/'], description: 'Open AI Assistant', category: 'Actions' },
  { keys: ['⌘/Ctrl', 'u'], description: 'Quick Upload', category: 'Actions' },
  { keys: ['n'], description: 'New Contract', category: 'Actions' },
  { keys: ['r'], description: 'Refresh Data', category: 'Actions' },
  
  // UI
  { keys: ['?'], description: 'Show Keyboard Shortcuts', category: 'UI' },
  { keys: ['Esc'], description: 'Close Modal/Panel', category: 'UI' },
  { keys: ['⌘/Ctrl', 'd'], description: 'Toggle Dark Mode', category: 'UI' },
  { keys: ['⌘/Ctrl', 'b'], description: 'Toggle Sidebar', category: 'UI' },
  
  // Search
  { keys: ['/'], description: 'Focus Search', category: 'Search' },
  { keys: ['⌘/Ctrl', 'f'], description: 'Find in Page', category: 'Search' },
];

const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
  const category = shortcut.category ?? 'other';
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category]!.push(shortcut);
  return acc;
}, {} as Record<string, KeyboardShortcut[]>);

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

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
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                       md:max-w-2xl md:w-full md:max-h-[80vh] 
                       bg-white dark:bg-slate-900 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 
                         transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="grid gap-6 md:grid-cols-2">
                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-1.5"
                        >
                          <span className="text-sm text-foreground">
                            {shortcut.description}
                          </span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <React.Fragment key={keyIndex}>
                                {keyIndex > 0 && (
                                  <span className="text-muted-foreground text-xs">+</span>
                                )}
                                <kbd className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 
                                              rounded border border-gray-200 dark:border-gray-700
                                              min-w-[28px] text-center">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-900 rounded border text-[10px]">?</kbd> anytime to show this overlay
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage keyboard shortcuts overlay
 */
export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      // Show shortcuts on "?"
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

/**
 * Global keyboard navigation hook
 */
export function useKeyboardNavigation() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      // Handle "g" prefix for navigation
      if (pendingKey === 'g') {
        const routes: Record<string, string> = {
          h: '/',
          c: '/contracts',
          u: '/upload',
          a: '/analytics',
          s: '/search',
        };
        
        const route = routes[e.key as keyof typeof routes];
        if (route) {
          e.preventDefault();
          window.location.href = route;
        }
        setPendingKey(null);
        return;
      }
      
      // Start "g" sequence
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        setPendingKey('g');
        // Reset after timeout
        setTimeout(() => setPendingKey(null), 1000);
        return;
      }
      
      // Focus search on "/"
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (searchInput) {
          searchInput.focus();
        }
      }
      
      // Toggle dark mode on Cmd/Ctrl + D
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const root = document.documentElement;
        const isDark = root.classList.contains('dark');
        root.classList.toggle('dark', !isDark);
        root.classList.toggle('light', isDark);
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
      }
      
      // Refresh on "r"
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const refreshButton = document.querySelector<HTMLButtonElement>('[data-refresh-button]');
        if (refreshButton) {
          refreshButton.click();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingKey]);
  
  return { pendingKey };
}

export default KeyboardShortcutsOverlay;
