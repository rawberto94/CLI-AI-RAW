'use client';

/**
 * Command Palette (⌘K)
 * Quick navigation and action execution
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Command,
  Search,
  Home,
  FileText,
  Upload,
  Settings,
  Bell,
  User,
  Plus,
  Clock,
  Star,
  ArrowRight,
  Hash,
  Sparkles,
  Moon,
  Sun,
  LogOut,
  HelpCircle,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string[];
  category: 'navigation' | 'actions' | 'recent' | 'settings';
  action: () => void;
  keywords?: string[];
}

interface CommandGroup {
  label: string;
  items: CommandItem[];
}

// ============================================================================
// Hook
// ============================================================================

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}

// ============================================================================
// Components
// ============================================================================

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  customCommands?: CommandItem[];
}

export function CommandPalette({ isOpen, onClose, customCommands = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Default commands
  const defaultCommands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-home', label: 'Go to Dashboard', icon: Home, category: 'navigation', action: () => router.push('/dashboard'), keywords: ['home', 'main'] },
    { id: 'nav-contracts', label: 'Go to Contracts', icon: FileText, category: 'navigation', action: () => router.push('/contracts'), keywords: ['documents', 'files'] },
    { id: 'nav-upload', label: 'Go to Upload', icon: Upload, category: 'navigation', action: () => router.push('/upload'), keywords: ['new', 'add'] },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'navigation', action: () => router.push('/settings'), shortcut: ['G', 'S'] },
    { id: 'nav-notifications', label: 'Go to Notifications', icon: Bell, category: 'navigation', action: () => router.push('/notifications') },
    { id: 'nav-profile', label: 'Go to Profile', icon: User, category: 'navigation', action: () => router.push('/profile') },
    
    // Actions
    { id: 'action-new-contract', label: 'Upload New Contract', icon: Plus, category: 'actions', action: () => router.push('/upload'), shortcut: ['⌘', 'N'], keywords: ['create', 'add'] },
    { id: 'action-ai-assistant', label: 'Open AI Assistant', icon: Sparkles, category: 'actions', action: () => router.push('/assistant'), keywords: ['chat', 'help', 'ai'] },
    { id: 'action-search', label: 'Search Contracts', icon: Search, category: 'actions', action: () => router.push('/search'), shortcut: ['⌘', 'F'] },
    
    // Settings
    { id: 'settings-theme', label: 'Toggle Dark Mode', icon: Moon, category: 'settings', action: () => {}, keywords: ['dark', 'light', 'appearance'] },
    { id: 'settings-keyboard', label: 'Keyboard Shortcuts', icon: Keyboard, category: 'settings', action: () => {}, shortcut: ['?'], keywords: ['keys', 'hotkeys'] },
    { id: 'settings-help', label: 'Help & Support', icon: HelpCircle, category: 'settings', action: () => router.push('/help'), keywords: ['support', 'docs'] },
    { id: 'settings-logout', label: 'Sign Out', icon: LogOut, category: 'settings', action: () => router.push('/auth/logout'), keywords: ['logout', 'exit'] },
  ], [router]);

  const allCommands = useMemo(() => [...defaultCommands, ...customCommands], [defaultCommands, customCommands]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    
    const lowerQuery = query.toLowerCase();
    return allCommands.filter((cmd) => {
      const searchText = [cmd.label, cmd.description, ...(cmd.keywords || [])].join(' ').toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [query, allCommands]);

  // Group commands by category
  const groupedCommands: CommandGroup[] = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category]!.push(cmd);
    });

    const categoryLabels: Record<string, string> = {
      recent: 'Recent',
      navigation: 'Navigation',
      actions: 'Actions',
      settings: 'Settings',
    };

    return Object.entries(groups).map(([category, items]) => ({
      label: categoryLabels[category] || category,
      items,
    }));
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => groupedCommands.flatMap(g => g.items), [groupedCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].action();
          onClose();
        }
        break;
    }
  }, [flatItems, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

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
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="fixed inset-x-4 top-[15%] max-w-xl mx-auto z-50"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or search..."
                  aria-label="Command palette search"
                  className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 bg-slate-100 rounded-md">
                  ESC
                </kbd>
              </div>
              
              {/* Results */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
                {groupedCommands.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No results found</p>
                  </div>
                ) : (
                  groupedCommands.map((group) => (
                    <div key={group.label} className="mb-2">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const globalIndex = flatItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = item.icon;
                        
                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => {
                              item.action();
                              onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                              'transition-colors duration-75',
                              isSelected
                                ? 'bg-indigo-50 text-indigo-900'
                                : 'text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <div className={cn(
                              'p-2 rounded-lg',
                              isSelected ? 'bg-indigo-100' : 'bg-slate-100'
                            )}>
                              <Icon className={cn(
                                'w-4 h-4',
                                isSelected ? 'text-indigo-600' : 'text-slate-500'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-slate-500 truncate">{item.description}</p>
                              )}
                            </div>
                            {item.shortcut && (
                              <div className="flex items-center gap-1">
                                {item.shortcut.map((key, i) => (
                                  <kbd key={i} className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                                    {key}
                                  </kbd>
                                ))}
                              </div>
                            )}
                            {isSelected && (
                              <ArrowRight className="w-4 h-4 text-indigo-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              
              {/* Footer */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↵</kbd>
                    select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>K to open</span>
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Provider
// ============================================================================

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useCommandPalette();
  
  return (
    <>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </>
  );
}
