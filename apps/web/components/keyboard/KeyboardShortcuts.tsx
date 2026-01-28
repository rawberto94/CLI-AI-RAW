'use client';

/**
 * Keyboard Shortcuts Overlay
 * Shows available keyboard shortcuts with beautiful UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Command, 
  X, 
  Search,
  Upload,
  Home,
  FileText,
  Settings,
  Bell,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Keyboard,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Shortcut {
  keys: string[];
  description: string;
  icon?: LucideIcon;
  category: 'navigation' | 'actions' | 'editing' | 'global';
}

// ============================================================================
// Shortcut Definitions
// ============================================================================

const SHORTCUTS: Shortcut[] = [
  // Global
  { keys: ['⌘', 'K'], description: 'Open command palette', icon: Command, category: 'global' },
  { keys: ['?'], description: 'Show keyboard shortcuts', icon: Keyboard, category: 'global' },
  { keys: ['Esc'], description: 'Close modal / Cancel', category: 'global' },
  
  // Navigation
  { keys: ['G', 'H'], description: 'Go to Dashboard', icon: Home, category: 'navigation' },
  { keys: ['G', 'C'], description: 'Go to Contracts', icon: FileText, category: 'navigation' },
  { keys: ['G', 'U'], description: 'Go to Upload', icon: Upload, category: 'navigation' },
  { keys: ['G', 'S'], description: 'Go to Settings', icon: Settings, category: 'navigation' },
  { keys: ['G', 'N'], description: 'Go to Notifications', icon: Bell, category: 'navigation' },
  
  // Actions
  { keys: ['⌘', 'N'], description: 'New contract upload', icon: Plus, category: 'actions' },
  { keys: ['⌘', 'F'], description: 'Focus search', icon: Search, category: 'actions' },
  { keys: ['⌘', 'Enter'], description: 'Submit form', icon: CornerDownLeft, category: 'actions' },
  
  // Editing / List Navigation
  { keys: ['↑', '↓'], description: 'Navigate list items', category: 'editing' },
  { keys: ['Enter'], description: 'Open selected item', icon: CornerDownLeft, category: 'editing' },
  { keys: ['⌘', 'A'], description: 'Select all', category: 'editing' },
  { keys: ['Delete'], description: 'Delete selected', category: 'editing' },
];

const CATEGORIES = {
  global: { label: 'Global', color: 'from-purple-500 to-purple-500' },
  navigation: { label: 'Navigation', color: 'from-violet-500 to-purple-500' },
  actions: { label: 'Actions', color: 'from-violet-500 to-violet-500' },
  editing: { label: 'Editing', color: 'from-orange-500 to-amber-500' },
};

// ============================================================================
// Hook
// ============================================================================

export function useKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open shortcuts overlay with ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setIsOpen(true);
        }
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return { isOpen, setIsOpen };
}

// ============================================================================
// Components
// ============================================================================

interface KeyProps {
  children: React.ReactNode;
  className?: string;
}

function Key({ children, className }: KeyProps) {
  return (
    <kbd className={cn(
      'inline-flex items-center justify-center min-w-[28px] h-7 px-2',
      'bg-white border border-slate-200 rounded-md shadow-sm',
      'text-xs font-medium text-slate-700',
      'transition-all duration-100',
      className
    )}>
      {children}
    </kbd>
  );
}

interface ShortcutItemProps {
  shortcut: Shortcut;
}

function ShortcutItem({ shortcut }: ShortcutItemProps) {
  const Icon = shortcut.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <span className="text-sm text-slate-700">{shortcut.description}</span>
      </div>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <React.Fragment key={i}>
            <Key>{key}</Key>
            {i < shortcut.keys.length - 1 && (
              <span className="text-slate-300 text-xs mx-0.5">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  const groupedShortcuts = SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category]!.push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-x-4 top-[10%] max-w-2xl mx-auto z-50"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-500 rounded-lg">
                    <Keyboard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Keyboard Shortcuts</h2>
                    <p className="text-sm text-slate-500">Navigate faster with keyboard</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn(
                          'w-2 h-2 rounded-full bg-gradient-to-r',
                          CATEGORIES[category as keyof typeof CATEGORIES].color
                        )} />
                        <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                          {CATEGORIES[category as keyof typeof CATEGORIES].label}
                        </h3>
                      </div>
                      <div className="space-y-1">
                        {shortcuts.map((shortcut, i) => (
                          <ShortcutItem key={i} shortcut={shortcut} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <span>Press</span>
                  <Key>?</Key>
                  <span>anywhere to show this help</span>
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
// Combined Provider Component
// ============================================================================

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useKeyboardShortcuts();
  
  return (
    <>
      {children}
      <KeyboardShortcutsOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
