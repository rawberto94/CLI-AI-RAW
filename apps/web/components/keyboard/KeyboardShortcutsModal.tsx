/**
 * Keyboard Shortcuts Modal
 * Displays available keyboard shortcuts in a modal
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Search } from 'lucide-react';
import { 
  KeyboardShortcut, 
  formatShortcut, 
  groupShortcutsByCategory 
} from '@/hooks/useKeyboardShortcuts';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsModal({ 
  isOpen, 
  onClose, 
  shortcuts 
}: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredShortcuts, setFilteredShortcuts] = useState(shortcuts);

  useEffect(() => {
    if (searchQuery) {
      const filtered = shortcuts.filter(shortcut =>
        shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortcut.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortcut.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredShortcuts(filtered);
    } else {
      setFilteredShortcuts(shortcuts);
    }
  }, [searchQuery, shortcuts]);

  const groupedShortcuts = groupShortcutsByCategory(filteredShortcuts);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Keyboard className="w-6 h-6" />
                    <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search shortcuts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                {Object.keys(groupedShortcuts).length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No shortcuts found matching &ldquo;{searchQuery}&rdquo;</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {categoryShortcuts.map((shortcut, index) => (
                            <ShortcutRow key={index} shortcut={shortcut} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t bg-gray-50 px-6 py-4">
                <p className="text-sm text-gray-600 text-center">
                  Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">?</kbd> to toggle this help
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Shortcut Row Component
// ============================================================================

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors">
      <span className="text-sm text-gray-700">{shortcut.description}</span>
      <kbd className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-900 shadow-sm">
        {formatShortcut(shortcut)}
      </kbd>
    </div>
  );
}

// ============================================================================
// Keyboard Shortcut Indicator (shows shortcut hint on hover)
// ============================================================================

export interface ShortcutIndicatorProps {
  shortcut: KeyboardShortcut;
  children: React.ReactNode;
}

export function ShortcutIndicator({ shortcut, children }: ShortcutIndicatorProps) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {formatShortcut(shortcut)}
      </div>
    </div>
  );
}
